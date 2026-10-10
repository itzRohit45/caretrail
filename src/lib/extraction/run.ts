import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { callGemini, ModelError } from "./gemini";
import { dropEmpty, extractionSchema, type Extraction } from "./schema";

export type ExtractionResult =
  | { ok: true; data: Extraction; model: string; cached: boolean }
  | { ok: false; reason: "timeout" | "unavailable" | "invalid" };

// Each attempt gets the PRD's 30 s. The model's response time swings widely under load (the same page
// took 4 s and then 39 s), so if the first model has not answered after 12 s the second starts in
// parallel and the first valid answer wins; the other request is cancelled.
const ATTEMPT_MS = 30_000;
const HEDGE_AFTER_MS = 12_000;

type Attempt = { ok: true; data: Extraction; model: string } | { ok: false; reason: "timeout" | "unavailable" | "invalid" };

async function attempt(model: string, file: { data: Buffer; mimeType: string }, cancel: AbortSignal): Promise<Attempt> {
  try {
    const data = parse(await callGemini(model, file, ATTEMPT_MS, cancel));
    return data ? { ok: true, data, model } : { ok: false, reason: "invalid" };
  } catch (err) {
    if (!cancel.aborted) console.warn(`extraction attempt failed model=${model} kind=${err instanceof ModelError ? err.kind : "error"} status=${err instanceof ModelError ? (err.status ?? "-") : "-"}`);
    return { ok: false, reason: err instanceof ModelError && err.kind === "timeout" ? "timeout" : "unavailable" };
  }
}

/** First model now; the second after HEDGE_AFTER_MS or as soon as the first fails. First valid answer wins. */
function race(models: string[], file: { data: Buffer; mimeType: string }): Promise<Attempt> {
  const cancel = new AbortController();
  return new Promise((resolve) => {
    let launched = 0;
    let pending = 0;
    let settled = false;
    let last: Attempt = { ok: false, reason: "unavailable" };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: Attempt) => {
      settled = true;
      clearTimeout(timer);
      cancel.abort();
      resolve(r);
    };
    const launch = () => {
      const model = models[launched++];
      pending++;
      void attempt(model, file, cancel.signal).then((r) => {
        pending--;
        if (settled) return;
        if (r.ok) return finish(r);
        last = r;
        if (launched < models.length) {
          clearTimeout(timer);
          return launch();
        }
        if (pending === 0) finish(last);
      });
    };
    launch();
    if (models.length > 1) timer = setTimeout(() => !settled && launched < models.length && launch(), HEDGE_AFTER_MS);
  });
}

function parse(text: string): Extraction | null {
  try {
    const parsed = extractionSchema.safeParse(dropEmpty(JSON.parse(text)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Reads a document once. A cached result for the same file hash is reused, so a file is never
 * read again once it has been read. Two models at most, raced as described above.
 */
export async function extractDocument(file: { hash: string; data: Buffer; mimeType: string }): Promise<ExtractionResult> {
  const admin = adminClient();
  const { data: hit } = await admin.from("extraction_cache").select("result, model").eq("file_hash", file.hash).maybeSingle();
  if (hit) {
    const cached = extractionSchema.safeParse(hit.result);
    if (cached.success) return { ok: true, data: cached.data, model: hit.model, cached: true };
  }

  const models = serverEnv().GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean).slice(0, 2);
  if (!models.length) return { ok: false, reason: "unavailable" };
  const started = Date.now();
  const result = await race(models, file);
  if (!result.ok) return result;
  await admin.from("extraction_cache").upsert({ file_hash: file.hash, model: result.model, result: result.data });
  console.info(`extraction ok model=${result.model} ms=${Date.now() - started}`);
  return { ok: true, data: result.data, model: result.model, cached: false };
}
