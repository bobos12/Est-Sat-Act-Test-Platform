import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Claude when ANTHROPIC_API_KEY is set, otherwise Google Gemini (free tier) when GEMINI_API_KEY is set. */
const isGeminiMode = () => !process.env.ANTHROPIC_API_KEY && Boolean(process.env.GEMINI_API_KEY);

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
}

/** Parallel model calls to allow. Gemini's free tier has tight rate limits, so it runs one at a time. */
export const aiConcurrency = (preferred: number) => (isGeminiMode() ? 1 : preferred);

export function anthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  return new Anthropic({ apiKey });
}

/** Model for extraction and generation. Override with ANTHROPIC_MODEL. */
export const aiModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/**
 * Calls the model with a single forced tool and returns the tool input.
 * Streaming is used so long outputs (a whole exam paper) don't hit request timeouts.
 */
export async function callTool<T>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  tool: { name: string; description: string; input_schema: Anthropic.Tool.InputSchema };
  maxTokens?: number;
}): Promise<T> {
  if (isGeminiMode()) return callGemini<T>(opts);
  const stream = anthropic().messages.stream({
    model: aiModel(),
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.content }],
  });
  const message = await stream.finalMessage();
  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("The model did not return structured output.");
  if (message.stop_reason === "max_tokens") throw new Error("The model's answer was cut off (too long). Try fewer questions per request.");
  return block.input as T;
}

/** Run async tasks with limited concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Preferred model first, then fallbacks for when one is retired (404) or overloaded (503). */
const geminiModels = () => [...new Set([process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"].filter(Boolean) as string[])];

/** Gemini accepts an OpenAPI subset: keep the keys it understands. */
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (node && typeof node === "object") {
    const allowed = ["type", "properties", "required", "enum", "items", "description", "minItems", "maxItems"];
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => allowed.includes(k) || k === "properties")
        .map(([k, v]) => [k, k === "properties" ? Object.fromEntries(Object.entries(v as object).map(([n, c]) => [n, geminiSchema(c)])) : geminiSchema(v)]),
    );
  }
  return node;
}

/** GEMINI_API_KEY may hold several comma-separated keys (from different projects); exhausted keys are skipped. */
const geminiKeys = () => (process.env.GEMINI_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
let keyIndex = 0;

async function callGemini<T>(opts: {
  content: Anthropic.ContentBlockParam[];
  system: string;
  tool: { name: string; description: string; input_schema: Anthropic.Tool.InputSchema };
  maxTokens?: number;
}): Promise<T> {
  const parts = opts.content.flatMap((b): ({ text: string } | { inlineData: { mimeType: string; data: string } })[] => {
    if (b.type === "text") return [{ text: b.text }];
    if (b.type === "document" && b.source.type === "base64") return [{ inlineData: { mimeType: b.source.media_type, data: b.source.data } }];
    return [];
  });
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    tools: [{ functionDeclarations: [{ name: opts.tool.name, description: opts.tool.description, parameters: geminiSchema(opts.tool.input_schema) }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [opts.tool.name] } },
    generationConfig: { maxOutputTokens: Math.min(opts.maxTokens ?? 16000, 65000), temperature: 0.2 },
  });
  const models = geminiModels();
  let mi = 0;
  const keys = geminiKeys();
  let keysTried = 1;

  // Free tier: switch to the next key when one runs out of quota, otherwise back off and retry.
  for (let attempt = 0; ; attempt++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${models[mi]}:generateContent`;
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": keys[keyIndex % keys.length] }, body, signal: AbortSignal.timeout(240000) });
    if (res.status === 429 && keysTried < keys.length) {
      keyIndex = (keyIndex + 1) % keys.length;
      keysTried++;
      attempt--;
      continue;
    }
    if (res.status === 503 && mi < models.length - 1 && attempt >= 1) {
      mi++;
      continue;
    }
    if ((res.status === 429 || res.status === 503) && attempt < 8) {
      await new Promise((r) => setTimeout(r, Math.min(60000, 8000 * 2 ** attempt)));
      continue;
    }
    // A retired model name: fall back to Google's rolling alias instead of failing the import.
    if (res.status === 404 && mi < models.length - 1) {
      mi++;
      continue;
    }
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { functionCall?: { args: unknown } }[] } }[];
    };
    const cand = json.candidates?.[0];
    const call = cand?.content?.parts?.find((p) => p.functionCall)?.functionCall;
    if (!call) throw new Error("The model did not return structured output.");
    if (cand?.finishReason === "MAX_TOKENS") throw new Error("The model's answer was cut off (too long). Try fewer questions per request.");
    return call.args as T;
  }
}
