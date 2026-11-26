"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured } from "@/lib/ai/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunOptions } from "./import-actions";

export type UploadState = { error?: string; ok?: string; docId?: string; docTitle?: string; run?: RunOptions } | undefined;

const MAX_PDF = 50 * 1024 * 1024;

const uploadSchema = z.object({
  subject_id: z.string().uuid(),
  kind: z.enum(["question_paper", "answer_key", "reference"]),
  title: z.string().trim().min(3).max(200),
  session_label: z.string().trim().max(60).default(""),
  paired_document_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable()),
});

async function pageCount(bytes: Uint8Array) {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    return pdf.numPages;
  } catch {
    return null;
  }
}

type StoreInput = z.infer<typeof uploadSchema> & { file: File };

/** Stores a PDF privately and records it. A file that is already stored is reused, never replaced. */
async function storeDocument(supabase: SupabaseClient, viewerId: string, input: StoreInput): Promise<{ id: string; existing: boolean } | { error: string }> {
  const { file, ...meta } = input;
  if (file.size === 0) return { error: "Choose a PDF file." };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return { error: "Only PDF files are accepted." };
  if (file.size > MAX_PDF) return { error: "PDFs must be under 50 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(bytes.slice(0, 5)).toString() !== "%PDF-") return { error: "That file is not a valid PDF." };
  const sha = createHash("sha256").update(bytes).digest("hex");

  const { data: existing } = await supabase.from("source_documents").select("id, title").eq("file_sha256", sha).maybeSingle();
  if (existing) return { id: existing.id, existing: true };

  const { data: subject } = await supabase.from("subjects").select("code").eq("id", meta.subject_id).single();
  const path = `${subject?.code ?? "misc"}/${sha}.pdf`;
  const { error: upErr } = await supabase.storage.from("source-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr && !upErr.message.toLowerCase().includes("exists")) return { error: `Upload failed: ${upErr.message}` };

  const { data: doc, error } = await supabase
    .from("source_documents")
    .insert({
      ...meta,
      session_label: meta.session_label || null,
      storage_path: path,
      file_sha256: sha,
      file_size_bytes: file.size,
      page_count: await pageCount(bytes),
      uploaded_by: viewerId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Link an answer key to its paper in both directions when one was chosen.
  if (meta.paired_document_id) {
    await supabase.from("source_documents").update({ paired_document_id: doc.id }).eq("id", meta.paired_document_id).is("paired_document_id", null);
  }
  return { id: doc.id, existing: false };
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

/** Adds a PDF to the knowledge base. A paper with its answer key is imported and published automatically. */
export async function uploadDocument(_: UploadState, formData: FormData): Promise<UploadState> {
  const { supabase, viewer } = await adminClient();
  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a PDF file." };
  if (parsed.data.kind === "answer_key" && !parsed.data.paired_document_id) return { error: "Choose the exam paper this answer key belongs to." };

  const stored = await storeDocument(supabase, viewer.id, { ...parsed.data, file });
  if ("error" in stored) return stored;
  if (stored.existing) return { error: "This file is already in the knowledge base. Nothing was changed." };

  // The answer key completes a paper: the form starts its import (step by step, in the browser).
  const paperId = parsed.data.kind === "answer_key" ? parsed.data.paired_document_id : null;
  if (paperId && aiConfigured()) {
    const { data: paper } = await supabase.from("source_documents").select("title, extracted_question_count").eq("id", paperId).single();
    if (paper && paper.extracted_question_count === 0) return { ok: `Added “${parsed.data.title}”. Importing its paper now.`, docId: paperId, docTitle: paper.title, run: {} };
  }
  return { ok: `Added “${parsed.data.title}”.${parsed.data.kind === "question_paper" ? " Upload its answer key (set to this paper) to publish it automatically." : ""}` };
}

function inferFromName(name: string) {
  const n = name.toLowerCase();
  const est2 = /\best\s*(2|ii)\b/.test(n);
  const sat = /\bsat\b/.test(n);
  const act = /\bact\b/.test(n);
  const code = sat
    ? n.includes("math") ? "sat-math" : /english|reading|writing|verbal/.test(n) ? "sat-english" : null
    : act
    ? n.includes("math") ? "act-math" : n.includes("english") ? "act-english" : /bio|science/.test(n) ? "act-biology" : null
    : est2
    ? /level\s*2/.test(n) ? "est2-math2" : /level\s*1/.test(n) ? "est2-math1" : n.includes("biology") ? "est2-biology" : n.includes("chem") ? "est2-chemistry" : null
    : n.includes("literacy") ? "est1-literacy" : n.includes("math") ? "est1-math" : null;
  if (!code) return { error: "Could not tell the subject from the file name." } as const;
  const months: Record<string, string> = { jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June", jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December" };
  const m = n.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(20\d\d)/);
  const session = n.includes("sample") ? "Sample" : m ? `${months[m[1]]} ${m[2]}` : "";
  return { code, session } as const;
}

/** One-step import of a paper and its answer key: stores both, extracts, and publishes the exam. */
export async function importExam(_: UploadState, formData: FormData): Promise<UploadState> {
  const { supabase, viewer } = await adminClient();
  const paper = formData.get("paper");
  const key = formData.get("key");
  if (!(paper instanceof File) || paper.size === 0) return { error: "Missing question paper." };
  const info = inferFromName(paper.name);
  if ("error" in info) return { error: `${paper.name}: ${info.error}` };
  const { data: subject } = await supabase.from("subjects").select("id").eq("code", info.code).single();
  if (!subject) return { error: "Subject not found." };

  const base = { subject_id: subject.id, session_label: info.session, paired_document_id: null };
  const p = await storeDocument(supabase, viewer.id, { ...base, kind: "question_paper", title: paper.name.replace(/\.pdf$/i, ""), file: paper });
  if ("error" in p) return p;
  if (key instanceof File && key.size > 0) {
    const k = await storeDocument(supabase, viewer.id, { ...base, kind: "answer_key", title: key.name.replace(/\.pdf$/i, ""), file: key, paired_document_id: p.id });
    if ("error" in k) return k;
    if (k.existing) await supabase.from("source_documents").update({ paired_document_id: p.id }).eq("id", k.id).is("paired_document_id", null);
  }
  return { docId: p.id, docTitle: paper.name.replace(/\.pdf$/i, ""), run: {} };
}

const readySchema = z.object({
  title: z.string().trim().min(3, "Give the exam a title.").max(120),
  subject_id: z.string().uuid("Choose a subject."),
  access: z.enum(["free", "premium"]),
  duration: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(300).optional()),
});

/** Upload any ready exam PDF (answer key optional): the AI cuts it into questions and publishes the exam. */
export async function uploadReadyExam(_: UploadState, formData: FormData): Promise<UploadState> {
  const { supabase, viewer } = await adminClient();
  const parsed = readySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const paper = formData.get("paper");
  const key = formData.get("key");
  if (!(paper instanceof File) || paper.size === 0) return { error: "Choose the exam PDF." };
  const clash = await findExamByTitle(supabase, parsed.data.title);
  if (clash) return { error: `An exam called “${clash.title}” already exists. Choose a different title.` };

  const base = { subject_id: parsed.data.subject_id, session_label: "", paired_document_id: null };
  const p = await storeDocument(supabase, viewer.id, { ...base, kind: "question_paper", title: parsed.data.title, file: paper });
  if ("error" in p) return p;
  if (key instanceof File && key.size > 0) {
    const k = await storeDocument(supabase, viewer.id, { ...base, kind: "answer_key", title: `${parsed.data.title} (answer key)`, file: key, paired_document_id: p.id });
    if ("error" in k) return k;
    if (k.existing) await supabase.from("source_documents").update({ paired_document_id: p.id }).eq("id", k.id).is("paired_document_id", null);
  }
  return { docId: p.id, docTitle: parsed.data.title, run: { title: parsed.data.title, access: parsed.data.access, duration: parsed.data.duration, anyPdf: true } };
}

export async function markReviewed(formData: FormData) {
  const { supabase } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  await supabase.from("source_documents").update({ status: "reviewed" }).eq("id", id).eq("status", "extracted");
  redirect(`/admin/knowledge/${id}?ok=${encodeURIComponent("Marked as reviewed.")}`);
}

export async function retireQuestion(formData: FormData) {
  const { supabase } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  const doc = z.string().uuid().parse(formData.get("doc"));
  await supabase.from("questions").update({ status: "retired" }).eq("id", id).eq("origin", "source");
  redirect(`/admin/knowledge/${doc}?ok=${encodeURIComponent("Question excluded from the knowledge base.")}`);
}

/** An existing exam with this title (case-insensitive) or the same URL slug. */
async function findExamByTitle(supabase: SupabaseClient, title: string) {
  const t = title.trim();
  if (!t) return null;
  // Exact, case-insensitive match: escape the LIKE wildcards in the title itself.
  const pattern = t.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [{ data: byTitle }, { data: bySlug }] = await Promise.all([
    supabase.from("exams").select("id, title, status").ilike("title", pattern).limit(1).maybeSingle(),
    supabase.from("exams").select("id, title, status").eq("slug", slugify(t)).limit(1).maybeSingle(),
  ]);
  return byTitle ?? bySlug;
}

/** Live check for the upload form: is this exam title already used? */
export async function examTitleTaken(title: string): Promise<{ taken: false } | { taken: true; id: string; title: string; status: string }> {
  const { supabase } = await adminClient();
  const hit = await findExamByTitle(supabase, String(title).slice(0, 140));
  return hit ? { taken: true, ...hit } : { taken: false };
}
