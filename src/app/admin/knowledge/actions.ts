"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured } from "@/lib/ai/client";
import { extractPaper, planChunks, planPageChunks } from "@/lib/ai/extract";
import { solveMissingAnswers } from "@/lib/ai/solve";
import { attachFigures } from "@/lib/ai/figures";
import { publishSourceExam, saveExtraction } from "@/lib/admin/persist";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadState = { error?: string; ok?: string } | undefined;

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

/**
 * Reads a paper (with its answer key) and publishes it as a student exam in the library.
 * Returns a human message. Throws on failure after marking the document failed.
 */
type PublishOptions = { title?: string; access?: "free" | "premium"; duration?: number; anyPdf?: boolean };

async function extractAndPublish(supabase: SupabaseClient, viewerId: string, id: string, opts: PublishOptions = {}): Promise<string> {
  if (!aiConfigured()) throw new Error("Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to the server environment to enable document analysis.");
  const { data: doc } = await supabase
    .from("source_documents")
    .select("id, subject_id, kind, status, title, session_label, storage_path, paired_document_id, extracted_question_count, subjects(name, official_duration_minutes, official_question_count, official_sections)")
    .eq("id", id)
    .single();
  if (!doc) throw new Error("Document not found.");
  if (doc.kind !== "question_paper") throw new Error("Process the question paper. Its answer key is read alongside it automatically.");
  if (doc.status === "processing") throw new Error("This document is already being processed.");
  if (doc.extracted_question_count > 0) throw new Error("This paper has already been extracted. Its questions are below.");

  await supabase.from("source_documents").update({ status: "processing", status_detail: "Reading the paper…" }).eq("id", id);
  try {
    const { data: paper, error: dlErr } = await supabase.storage.from("source-documents").download(doc.storage_path);
    if (dlErr || !paper) throw new Error(`Could not read the PDF: ${dlErr?.message}`);

    let key: Buffer | undefined;
    const { data: keyDoc } = await supabase
      .from("source_documents")
      .select("storage_path")
      .eq("kind", "answer_key")
      .or(`id.eq.${doc.paired_document_id ?? "00000000-0000-0000-0000-000000000000"},paired_document_id.eq.${id}`)
      .limit(1)
      .maybeSingle();
    if (keyDoc) {
      const { data: k } = await supabase.storage.from("source-documents").download(keyDoc.storage_path);
      if (k) key = Buffer.from(await k.arrayBuffer());
    }

    const { data: topics } = await supabase.from("topics").select("id, kind, name").eq("subject_id", doc.subject_id);
    const subject = Array.isArray(doc.subjects) ? doc.subjects[0] : doc.subjects;
    const paperBytes = Buffer.from(await paper.arrayBuffer());
    const result = await extractPaper({
      subjectName: subject?.name ?? "EST",
      chunks: opts.anyPdf ? planPageChunks((await pageCount(new Uint8Array(paperBytes))) ?? 12) : planChunks(subject?.official_sections ?? 1, subject?.official_question_count ?? 50),
      paper: paperBytes,
      answerKey: key,
      topics: (topics ?? []).filter((t) => t.kind === "topic").map((t) => t.name),
      skills: (topics ?? []).filter((t) => t.kind === "skill").map((t) => t.name),
      domains: (topics ?? []).filter((t) => t.kind === "domain").map((t) => t.name),
    });
    const solved = key ? 0 : await solveMissingAnswers(result);
    const figs = await attachFigures(supabase, paperBytes, id, result);
    const { saved, items } = await saveExtraction(supabase, { id, subject_id: doc.subject_id }, topics ?? [], result, viewerId);

    const title = opts.title ?? `${subject?.name ?? "EST"}${doc.session_label ? `: ${doc.session_label}` : ""}`;
    let slug = slugify(title);
    const { data: taken } = await supabase.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${id.slice(0, 6)}`;
    const outcome = await publishSourceExam(
      supabase,
      {
        subject_id: doc.subject_id,
        title,
        slug,
        access: opts.access ?? (/sample/i.test(doc.session_label ?? doc.title) ? "free" : "premium"),
        duration_minutes: opts.duration ?? subject?.official_duration_minutes ?? 75,
        sort_order: 100,
        created_by: viewerId,
      },
      items,
    );
    await supabase
      .from("source_documents")
      .update({
        status: outcome.published ? "reviewed" : "extracted",
        status_detail: `${key ? "Extracted with answer key" : "Extracted without an answer key, keys left blank"}${solved ? `; ${solved} answers worked out by AI` : ""}${figs.attached || figs.failed ? `; ${figs.attached} figures captured${figs.failed ? `, ${figs.failed} could not be rendered` : ""}` : ""}`,
        extracted_question_count: saved,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);
    updateTag(CATALOG_TAG);
    return outcome.published
      ? `${title}: ${saved} questions imported and published to the exam library.`
      : `${title}: ${saved} questions imported, but ${outcome.missingKeys} have no answer key, so the exam is waiting in review.`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    await supabase.from("source_documents").update({ status: "failed", status_detail: msg.slice(0, 500) }).eq("id", id);
    throw new Error(msg);
  }
}

/** Adds a PDF to the knowledge base. A paper with its answer key is imported and published automatically. */
export async function uploadDocument(_: UploadState, formData: FormData): Promise<UploadState> {
  const { supabase, viewer } = await adminClient();
  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a PDF file." };

  const stored = await storeDocument(supabase, viewer.id, { ...parsed.data, file });
  if ("error" in stored) return stored;
  if (stored.existing) return { error: "This file is already in the knowledge base. Nothing was changed." };

  // The answer key completes a paper: import it now.
  const paperId = parsed.data.kind === "answer_key" ? parsed.data.paired_document_id : null;
  if (paperId && aiConfigured()) {
    try {
      return { ok: await extractAndPublish(supabase, viewer.id, paperId) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Import failed" };
    }
  }
  return { ok: `Added “${parsed.data.title}”.${parsed.data.kind === "question_paper" ? " Upload its answer key (set to this paper) to publish it automatically." : ""}` };
}

function inferFromName(name: string) {
  const n = name.toLowerCase();
  const est2 = /est\s*(2|ii)/.test(n);
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
  try {
    return { ok: await extractAndPublish(supabase, viewer.id, p.id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return { error: `${paper.name}: ${msg}` };
  }
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

  const base = { subject_id: parsed.data.subject_id, session_label: "", paired_document_id: null };
  const p = await storeDocument(supabase, viewer.id, { ...base, kind: "question_paper", title: parsed.data.title, file: paper });
  if ("error" in p) return p;
  if (key instanceof File && key.size > 0) {
    const k = await storeDocument(supabase, viewer.id, { ...base, kind: "answer_key", title: `${parsed.data.title} (answer key)`, file: key, paired_document_id: p.id });
    if ("error" in k) return k;
    if (k.existing) await supabase.from("source_documents").update({ paired_document_id: p.id }).eq("id", k.id).is("paired_document_id", null);
  }
  try {
    return { ok: await extractAndPublish(supabase, viewer.id, p.id, { title: parsed.data.title, access: parsed.data.access, duration: parsed.data.duration, anyPdf: true }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed" };
  }
}

export async function processDocument(formData: FormData) {
  const { supabase, viewer } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  let msg: string;
  let ok = true;
  try {
    msg = await extractAndPublish(supabase, viewer.id, id);
  } catch (e) {
    ok = false;
    msg = e instanceof Error ? e.message : "Processing failed";
  }
  redirect(`/admin/knowledge/${id}?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
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
