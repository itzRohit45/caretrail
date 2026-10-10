import "server-only";
import { z } from "zod";

// Empty strings in .env files mean "not set".
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  GEMINI_API_KEY: optional,
  // Order chosen from a head-to-head on the demo documents (10 Oct 2026): lite was accurate and fast; 3.6-flash was often busy (503).
  GEMINI_MODELS: z.string().default("gemini-3.5-flash-lite,gemini-3.6-flash"),
  BREVO_API_KEY: optional,
  ALERT_FROM_EMAIL: optional,
  IP_HASH_SALT: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated on first use, so a missing secret fails loudly at request time, not silently. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${names}`);
    }
    cached = parsed.data;
  }
  return cached;
}
