import "server-only";
import { serverEnv } from "@/lib/env";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompt";
import { geminiResponseSchema } from "./schema";

export type ModelFailure = "timeout" | "unavailable" | "rejected" | "empty";

export class ModelError extends Error {
  constructor(readonly kind: ModelFailure, readonly status?: number) {
    super(kind);
  }
}

/** One generateContent call. Returns the raw JSON text the model produced. */
export async function callGemini(model: string, file: { data: Buffer; mimeType: string }, timeoutMs: number, cancel?: AbortSignal) {
  const key = serverEnv().GEMINI_API_KEY;
  if (!key) throw new ModelError("unavailable");
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: file.mimeType, data: file.data.toString("base64") } }, { text: EXTRACTION_USER_PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: geminiResponseSchema, temperature: 0 },
      }),
      signal: cancel ? AbortSignal.any([AbortSignal.timeout(timeoutMs), cancel]) : AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ModelError(err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "unavailable");
  }
  if (!res.ok) throw new ModelError(res.status === 429 || res.status >= 500 ? "unavailable" : "rejected", res.status);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new ModelError("empty");
  return text;
}
