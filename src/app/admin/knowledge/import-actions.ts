"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/admin/server";
import { publishSourceExam, saveExtraction } from "@/lib/admin/persist";
import { aiConfigured } from "@/lib/ai/client";
import { extractChunk, planChunks, planPageChunks } from "@/lib/ai/extract";
import { attachFigures } from "@/lib/ai/figures";
import type { AiQuestion, AiStimulus } from "@/lib/ai/schemas";
import { solveMissingAnswers } from "@/lib/ai/solve";
import { CATALOG_TAG } from "@/lib/catalog";
import { createServiceClient } from "@/lib/supabase/server";

/*
 * A paper is imported in steps, each its own request, so no request comes near the
 * server's 5-minute limit whatever the length of the PDF:
 *   startImport → extractPart (once per part) → finishImport
 * Each part's result is saved, so a stopped or failed run continues where it left off.
 * stopImport marks the run stopped; the next extractPart sees it and ends.
 */

export type RunOptions = { title?: string; access?: "free" | "premium"; duration?: number; anyPdf?: boolean };
type Part = { stimuli: AiStimulus[]; questions: AiQuestion[]; solved: number };
type Doc = {
  id: string;
  subject_id: string;
  kind: string;
  status: string;
  updated_at: string;
  title: string;
  session_label: string | null;
  storage_path: string;
  paired_document_id: string | null;
  extracted_question_count: number;
  page_count: number | null;
  subjects: { name: string; official_duration_minutes: number; official_question_count: number; official_sections: number } | null;
};

const BUCKET = "source-documents";
const STALE_MS = 6 * 60_000;
const partPath = (id: string, total: number, i: number) => `parts/${id}/${total}-${i}.json`;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/**
 * Saved part results live in their own private bucket (the PDF bucket only accepts PDFs), written with the
 * service key because admin storage policies don't allow writing or deleting there. Created on first use.
 */
const PARTS_BUCKET = "import-parts";
let partsReady: Promise<void> | null = null;
function parts() {
  const svc = createServiceClient();
  partsReady ??= (async () => {
    const { data } = await svc.storage.getBucket(PARTS_BUCKET);
    if (!data) {
      const { error } = await svc.storage.createBucket(PARTS_BUCKET, { public: false, allowedMimeTypes: ["application/json"], fileSizeLimit: "20MB" });
      if (error && !/exists/i.test(error.message)) {
        partsReady = null;
        throw new Error(`Could not prepare import storage: ${error.message}`);
      }
    }
  })();
  const bucket = svc.storage.from(PARTS_BUCKET);
  const ready = () => partsReady!;
  return {
    upload: async (...a: Parameters<typeof bucket.upload>) => (await ready(), bucket.upload(...a)),
    download: async (path: string) => (await ready(), bucket.download(path)),
    list: async (path: string) => (await ready(), bucket.list(path)),
    remove: async (paths: string[]) => (await ready(), bucket.remove(paths)),
  };
}

async function getDoc(supabase: SupabaseClient, id: string): Promise<Doc | null> {
  const { data } = await supabase
    .from("source_documents")
    .select(
      "id, subject_id, kind, status, updated_at, title, session_label, storage_path, paired_document_id, extracted_question_count, page_count, subjects(name, official_duration_minutes, official_question_count, official_sections)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...data, subjects: Array.isArray(data.subjects) ? data.subjects[0] : data.subjects } as Doc;
}

async function setProgress(supabase: SupabaseClient, id: string, pct: number, label: string) {
  await supabase.from("source_documents").update({ status_detail: `${Math.round(pct)}% · ${label}` }).eq("id", id).eq("status", "processing");
}

async function fail(supabase: SupabaseClient, id: string, msg: string) {
  await supabase.from("source_documents").update({ status: "failed", status_detail: msg.slice(0, 500) }).eq("id", id);
}

async function loadFiles(supabase: SupabaseClient, doc: Doc) {
  const { data: paper, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
  if (error || !paper) throw new Error(`Could not read the PDF: ${error?.message ?? "missing file"}`);
  let key: Buffer | undefined;
  const { data: keyDoc } = await supabase
    .from("source_documents")
    .select("storage_path")
    .eq("kind", "answer_key")
    .or(`id.eq.${doc.paired_document_id ?? "00000000-0000-0000-0000-000000000000"},paired_document_id.eq.${doc.id}`)
    .limit(1)
    .maybeSingle();
  if (keyDoc) {
    const { data: k } = await supabase.storage.from(BUCKET).download(keyDoc.storage_path);
    if (k) key = Buffer.from(await k.arrayBuffer());
  }
  return { paper: Buffer.from(await paper.arrayBuffer()), key };
}

function planFor(doc: Doc, opts: RunOptions) {
  return opts.anyPdf
    ? planPageChunks(doc.page_count ?? 12)
    : planChunks(doc.subjects?.official_sections ?? 1, doc.subjects?.official_question_count ?? 50);
}

/** Step 1: check the paper can be imported, mark it running, and plan its parts (skipping parts already read). */
export async function startImport(id: string, given: RunOptions = {}, fallback: RunOptions = {}): Promise<{ scopes: string[]; done: number[]; opts: RunOptions } | { error: string }> {
  const { supabase } = await adminClient();
  if (!aiConfigured()) return { error: "Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to the server environment to enable imports." };
  const doc = await getDoc(supabase, id);
  if (!doc) return { error: "Document not found." };
  if (doc.kind !== "question_paper") return { error: "Run the import on the question paper. Its answer key is read alongside it." };
  if (doc.extracted_question_count > 0) return { error: "This paper has already been imported. Its questions are on its page." };
  if (doc.status === "processing" && Date.now() - Date.parse(doc.updated_at) < STALE_MS) {
    return { error: "This paper is already being imported (maybe in another tab). Press Stop first if that run is stuck." };
  }

  // The options chosen at upload (title, access, minutes) are saved with the run, so a retry from anywhere reuses them.
  const store = parts();
  let opts = given;
  if (Object.keys(given).length) {
    await store.upload(`parts/${id}/run.json`, JSON.stringify(given), { contentType: "application/json", upsert: true });
  } else {
    const { data: saved } = await store.download(`parts/${id}/run.json`);
    if (saved) opts = JSON.parse(await saved.text()) as RunOptions;
    else if (Object.keys(fallback).length) {
      opts = fallback;
      await store.upload(`parts/${id}/run.json`, JSON.stringify(fallback), { contentType: "application/json", upsert: true });
    }
  }

  const scopes = planFor(doc, opts);
  const { data: files } = await store.list(`parts/${id}`);
  const prefix = `${scopes.length}-`;
  const done = (files ?? [])
    .map((f) => f.name)
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length).replace(/\.json$/, "")))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < scopes.length);

  await supabase
    .from("source_documents")
    .update({ status: "processing", status_detail: `${Math.round(10 + (70 * done.length) / scopes.length)}% · Reading the questions` })
    .eq("id", id);
  return { scopes, done, opts };
}

/** Step 2 (once per part): read one part of the paper with the AI and save the result. */
export async function extractPart(id: string, index: number, total: number, completedBefore: number, opts: RunOptions = {}): Promise<{ questions: number } | { error: string; stopped?: boolean }> {
  const { supabase } = await adminClient();
  const doc = await getDoc(supabase, id);
  if (!doc) return { error: "Document not found." };
  if (doc.status !== "processing") return { error: "The import was stopped.", stopped: true };
  const scopes = planFor(doc, opts);
  if (scopes.length !== total || index < 0 || index >= total) return { error: "The paper changed since the import started. Start it again." };

  try {
    const { paper, key } = await loadFiles(supabase, doc);
    const { data: topics } = await supabase.from("topics").select("kind, name").eq("subject_id", doc.subject_id);
    const part = await extractChunk(
      {
        subjectName: doc.subjects?.name ?? "EST",
        paper,
        answerKey: key,
        topics: (topics ?? []).filter((t) => t.kind === "topic").map((t) => t.name),
        skills: (topics ?? []).filter((t) => t.kind === "skill").map((t) => t.name),
        domains: (topics ?? []).filter((t) => t.kind === "domain").map((t) => t.name),
      },
      scopes[index],
      `c${index}-`,
    );
    // Without a key, work out this part's answers now, so no later step has to do them all at once.
    const solved = key || !part.questions.length ? 0 : await solveMissingAnswers(part);
    const body: Part = { ...part, solved };
    const { error } = await parts().upload(partPath(id, total, index), JSON.stringify(body), { contentType: "application/json", upsert: true });
    if (error) throw new Error(`Could not save part ${index + 1}: ${error.message}`);
    const n = completedBefore + 1;
    await setProgress(supabase, id, 10 + (70 * n) / total, `Reading the questions (part ${n} of ${total})`);
    return { questions: part.questions.length };
  } catch (e) {
    const msg = `Part ${index + 1} of ${total} failed: ${message(e)}`;
    await fail(supabase, id, `${msg} Press Run import to try again; finished parts are kept.`);
    return { error: msg };
  }
}

/** Step 3: combine the parts, capture figures, save the questions and publish the exam. */
export async function finishImport(id: string, total: number, opts: RunOptions = {}): Promise<{ ok: string } | { error: string }> {
  const { supabase, viewer } = await adminClient();
  const doc = await getDoc(supabase, id);
  if (!doc) return { error: "Document not found." };
  if (doc.status !== "processing") return { error: "The import was stopped." };

  try {
    const store = parts();
    const all: Part[] = [];
    for (let i = 0; i < total; i++) {
      const { data, error } = await store.download(partPath(id, total, i));
      if (error || !data) throw new Error(`Part ${i + 1} is missing. Press Run import to read it again.`);
      all.push(JSON.parse(await data.text()) as Part);
    }
    const result = { stimuli: all.flatMap((p) => p.stimuli), questions: all.flatMap((p) => p.questions) };
    if (!result.questions.length) throw new Error("No questions could be found in this PDF.");
    const solved = all.reduce((n, p) => n + (p.solved ?? 0), 0);

    const { paper, key } = await loadFiles(supabase, doc);
    await setProgress(supabase, id, 84, "Capturing figures and diagrams");
    const figs = await attachFigures(supabase, paper, id, result);
    await setProgress(supabase, id, 92, `Saving ${result.questions.length} questions`);
    const { data: topics } = await supabase.from("topics").select("id, kind, name").eq("subject_id", doc.subject_id);
    const { saved, items } = await saveExtraction(supabase, { id, subject_id: doc.subject_id }, topics ?? [], result, viewer.id);

    await setProgress(supabase, id, 97, "Publishing the exam");
    const title = opts.title ?? `${doc.subjects?.name ?? "EST"}${doc.session_label ? `: ${doc.session_label}` : ""}`;
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
        duration_minutes: opts.duration ?? doc.subjects?.official_duration_minutes ?? 75,
        sort_order: 100,
        created_by: viewer.id,
      },
      items,
    );
    await supabase
      .from("source_documents")
      .update({
        status: outcome.published ? "reviewed" : "extracted",
        status_detail: `${key ? "Extracted with answer key" : "Extracted without an answer key"}${solved ? `; ${solved} answers worked out by AI` : ""}${figs.attached || figs.failed ? `; ${figs.attached} figures captured${figs.failed ? `, ${figs.failed} could not be rendered` : ""}` : ""}`,
        extracted_question_count: saved,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);
    await store.remove([...Array.from({ length: total }, (_, i) => partPath(id, total, i)), `parts/${id}/run.json`]);
    updateTag(CATALOG_TAG);
    return {
      ok: outcome.published
        ? `${title}: ${saved} questions imported and published to the exam library.`
        : `${title}: ${saved} questions imported, but ${outcome.missingKeys} have no answer, so the exam is waiting in review.`,
    };
  } catch (e) {
    await fail(supabase, id, `${message(e)} Press Run import to try again.`);
    return { error: message(e) };
  }
}

/** Stop a running (or stuck) import. Parts already read are kept, so Run import continues from there. */
export async function stopImport(id: string): Promise<{ ok: true }> {
  const { supabase } = await adminClient();
  await supabase
    .from("source_documents")
    .update({ status: "failed", status_detail: "Stopped by you. Press Run import to continue where it left off." })
    .eq("id", id)
    .eq("status", "processing");
  return { ok: true };
}

/**
 * Delete a document from the knowledge base (a paper takes its answer key with it).
 * Exams built from it are kept; see migration 20261128000001_delete_source_documents.sql.
 */
export async function deleteDocument(formData: FormData) {
  const { supabase } = await adminClient();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/knowledge");
  const { data: doc } = await supabase.from("source_documents").select("title").eq("id", id).maybeSingle();
  const { data, error } = await supabase.rpc("admin_delete_source_document", { p_doc: id });
  if (error) {
    const missing = /could not find the function|does not exist/i.test(error.message);
    const msg = missing ? "Deleting needs the latest SQL update (delete_source_documents). Run it in the Supabase SQL Editor, then try again." : error.message;
    redirect(`/admin/knowledge/${id}?error=${encodeURIComponent(msg)}`);
  }
  const res = data as { ids: string[]; paths: string[]; removed: number; kept: number };

  // Files: the PDFs, any saved import parts, and figure images when no kept exam question still shows them.
  try {
    const svc = createServiceClient();
    if (res.paths?.length) await svc.storage.from(BUCKET).remove(res.paths);
    for (const docId of res.ids ?? []) {
      const store = parts();
      const { data: saved } = await store.list(`parts/${docId}`);
      if (saved?.length) await store.remove(saved.map((f) => `parts/${docId}/${f.name}`));
      if (!res.kept) {
        const { data: figs } = await svc.storage.from("question-media").list(`figures/${docId}`);
        if (figs?.length) await svc.storage.from("question-media").remove(figs.map((f) => `figures/${docId}/${f.name}`));
      }
    }
  } catch {
    /* the records are gone; leftover files are harmless */
  }
  revalidatePath("/admin/knowledge");
  const extra = [res.removed ? `${res.removed} reference questions removed` : "", res.kept ? `${res.kept} questions kept in their exams` : ""].filter(Boolean).join(", ");
  redirect(`/admin/knowledge?ok=${encodeURIComponent(`Deleted “${doc?.title ?? "document"}”${res.ids?.length > 1 ? " and its answer key" : ""}.${extra ? ` ${extra[0].toUpperCase()}${extra.slice(1)}.` : ""}`)}`);
}
