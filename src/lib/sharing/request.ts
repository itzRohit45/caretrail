import "server-only";
import { createHash } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

/** Client IP as seen by Vercel's edge, hashed with a server salt before it is stored. */
export function ipHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${serverEnv().IP_HASH_SALT}:${ip}`).digest("hex");
}

/** 30 requests per minute per IP on token routes (PRD). Shared counter in Postgres, so it holds across instances. */
export async function allowRequest(request: Request, bucket: string, limit = 30) {
  const { data, error } = await adminClient().rpc("rate_limit_hit", { p_key: `${bucket}:${ipHash(request)}`, p_limit: limit, p_window_seconds: 60 });
  // shortcut: fails open if the counter itself is unavailable, so a database hiccup never locks out a doctor mid-visit;
  // token, expiry, revocation and scope checks never fail open.
  return error ? true : Boolean(data);
}
