import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { callGemini, ModelError } from "./gemini";
import { dropEmpty, extractionSchema, type Extraction } from "./schema";

export type ExtractionResult =
  | { ok: true; data: Extraction; model: string; cached: boolean }
  | { ok: false; reason: "timeout" | "unavailable" | "invalid" };

const DEADLINE_MS = 30_000;

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
 * sent to the model twice. Within one 30 s deadline: first model, then one retry on the next model
 * if the first is busy, times out or returns invalid JSON.
 */
export async function extractDocument(file: { hash: string; data: Buffer; mimeType: string }): Promise<ExtractionResult> {
  const admin = adminClient();
  const { data: hit } = await admin.from("extraction_cache").select("result, model").eq("file_hash", file.hash).maybeSingle();
  if (hit) {
    const cached = extractionSchema.safeParse(hit.result);
    if (cached.success) return { ok: true, data: cached.data, model: hit.model, cached: true };
  }

  const models = serverEnv().GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
  const started = Date.now();
  let failure: "timeout" | "unavailable" | "invalid" = "unavailable";
  for (const model of models.slice(0, 2)) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 2_000) {
      failure = "timeout";
      break;
    }
    try {
      const text = await callGemini(model, file, remaining);
      const data = parse(text);
      if (!data) {
        failure = "invalid";
        continue;
      }
      await admin.from("extraction_cache").upsert({ file_hash: file.hash, model, result: data });
      console.info(`extraction ok model=${model} ms=${Date.now() - started}`);
      return { ok: true, data, model, cached: false };
    } catch (err) {
      failure = err instanceof ModelError && err.kind === "timeout" ? "timeout" : "unavailable";
      console.warn(`extraction attempt failed model=${model} kind=${err instanceof ModelError ? err.kind : "error"} status=${err instanceof ModelError ? (err.status ?? "-") : "-"}`);
    }
  }
  return { ok: false, reason: failure };
}
