import { INLINE_TOKEN, isBareMath } from "@/lib/content";

/*
 * Leak tracing. Every student gets an 8-character code built from the first 40 bits of
 * their user id. It is drawn faintly over exam screens (survives screenshots) and hidden
 * in question text as zero-width characters (survives "save page" and any copy that gets
 * past the copy block).
 * /admin/security turns a code, or pasted text, back into the account.
 */

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U
const ZERO = "\u200B";
const ONE = "\u200C";
const EDGE = "\u2060";
const MARK_RE = /\u2060([\u200B\u200C]{40})\u2060/g;

/** 8-character code for a user id. */
export function watermarkCode(userId: string) {
  let n = parseInt(userId.replace(/-/g, "").slice(0, 10), 16);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = B32[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/** The 10 hex characters a code stands for (the start of the user id), or null if it isn't a code. */
export function codeToHexPrefix(raw: string) {
  const code = raw.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(code)) return null;
  let n = 0;
  for (const ch of code) n = n * 32 + B32.indexOf(ch);
  return n.toString(16).padStart(10, "0");
}

/** The code as invisible characters. */
export function zwMark(code: string) {
  const hex = codeToHexPrefix(code);
  if (!hex) return "";
  const bits = parseInt(hex, 16).toString(2).padStart(40, "0");
  return EDGE + [...bits].map((b) => (b === "1" ? ONE : ZERO)).join("") + EDGE;
}

/** Every code hidden in a piece of text. */
export function decodeMarks(text: string) {
  const codes = new Set<string>();
  for (const m of text.matchAll(MARK_RE)) {
    const n = parseInt([...m[1]].map((c) => (c === ONE ? "1" : "0")).join(""), 2);
    codes.add(watermarkCode(n.toString(16).padStart(10, "0")));
  }
  return [...codes];
}

/** Insert the mark after the first space of plain text (never inside math, bold or passage markers). */
export function markText(text: string, mark: string) {
  if (!mark || text.includes(EDGE) || isBareMath(text)) return text;
  const parts = text.split(INLINE_TOKEN);
  for (let i = 0; i < parts.length; i += 2) {
    const at = parts[i].indexOf(" ");
    if (at !== -1) {
      parts[i] = parts[i].slice(0, at + 1) + mark + parts[i].slice(at + 1);
      return parts.join("");
    }
  }
  return text;
}

/** Copy of a payload with every paragraph of question content carrying the viewer's mark. */
export function fingerprintContent<T>(data: T, userId: string): T {
  const mark = zwMark(watermarkCode(userId));
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x);
      if (out.type === "paragraph" && typeof out.text === "string") out.text = markText(out.text, mark);
      return out;
    }
    return v;
  };
  return walk(data) as T;
}
