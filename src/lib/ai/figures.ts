import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiQuestion, AiStimulus } from "@/lib/ai/schemas";

type Box = [number, number, number, number];
const validBox = (b: unknown): b is Box =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && n >= 0 && n <= 1) && b[2] - b[0] > 0.05 && b[3] - b[1] > 0.03;

/**
 * Renders the PDF page(s) that hold figures, crops to the figure box the model reported (full page when the box
 * is missing or implausible), uploads the PNG to the public question-media bucket and prepends it to the content.
 */
export async function attachFigures(
  db: SupabaseClient,
  paper: Uint8Array,
  docId: string,
  data: { stimuli: AiStimulus[]; questions: AiQuestion[] },
) {
  const wanted = new Map<string, { page: number; box: Box | null }>();
  const key = (page: number, box: unknown) => `${page}:${validBox(box) ? box.map((n) => n.toFixed(3)).join(",") : "full"}`;
  const note = (page?: number | null, box?: unknown) => {
    if (!page || page < 1) return null;
    const k = key(page, box);
    if (!wanted.has(k)) wanted.set(k, { page, box: validBox(box) ? box : null });
    return k;
  };
  const qKeys = data.questions.map((q) => (q.has_figure ? note(q.page, q.figure_box) : null));
  const sKeys = data.stimuli.map((s) => (s.kind === "figure" || s.kind === "data_set" ? note(s.page, s.figure_box) : null));
  if (!wanted.size) return { attached: 0, failed: 0 };

  const urls = new Map<string, string>();
  let failed = 0;
  try {
    const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const pdf = await getDocumentProxy(new Uint8Array(paper));
    const pages = new Map<number, ArrayBuffer>();
    for (const [k, { page, box }] of wanted) {
      try {
        if (page > pdf.numPages) throw new Error("page out of range");
        if (!pages.has(page)) pages.set(page, await renderPageAsImage(pdf, page, { canvasImport: () => import("@napi-rs/canvas"), scale: 2 }));
        let png: Buffer = Buffer.from(pages.get(page)!);
        if (box) {
          const img = await loadImage(png);
          const pad = 0.015;
          const x0 = Math.max(0, box[0] - pad) * img.width, y0 = Math.max(0, box[1] - pad) * img.height;
          const x1 = Math.min(1, box[2] + pad) * img.width, y1 = Math.min(1, box[3] + pad) * img.height;
          const canvas = createCanvas(Math.round(x1 - x0), Math.round(y1 - y0));
          canvas.getContext("2d").drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, canvas.width, canvas.height);
          png = canvas.toBuffer("image/png");
        }
        const path = `figures/${docId}/${k.replace(/[^0-9a-z]+/gi, "_")}.png`;
        const { error } = await db.storage.from("question-media").upload(path, png, { contentType: "image/png", upsert: true });
        if (error) throw new Error(error.message);
        urls.set(k, db.storage.from("question-media").getPublicUrl(path).data.publicUrl);
      } catch {
        failed++;
      }
    }
  } catch {
    failed = wanted.size; // renderer unavailable: questions keep their text description
  }

  let attached = 0;
  data.questions.forEach((q, i) => {
    const url = qKeys[i] && urls.get(qKeys[i]!);
    if (url) {
      q.stem = `![Figure for question ${q.number ?? i + 1}](${url})\n\n${q.stem}`;
      attached++;
    }
  });
  data.stimuli.forEach((s, i) => {
    const url = sKeys[i] && urls.get(sKeys[i]!);
    if (url) s.content = `![${s.title || "Figure"}](${url})\n\n${s.content}`;
  });
  return { attached, failed };
}
