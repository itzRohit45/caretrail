import "server-only";
import { createHash } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

/** Client IP as seen by Vercel's edge, hashed with a server salt before it is stored. */
export function ipHashFromHeaders(headers: Headers) {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${serverEnv().IP_HASH_SALT}:${ip}`).digest("hex");
}
export const ipHash = (request: Request) => ipHashFromHeaders(request.headers);

/** 30 requests per minute per IP on token routes (PRD). Shared counter in Postgres, so it holds across instances. */
export async function allowRequest(request: Request | Headers, bucket: string, limit = 30, windowSeconds = 60) {
  const headers = request instanceof Headers ? request : request.headers;
  const { data, error } = await adminClient().rpc("rate_limit_hit", { p_key: `${bucket}:${ipHashFromHeaders(headers)}`, p_limit: limit, p_window_seconds: windowSeconds });
  // shortcut: fails open if the counter itself is unavailable, so a database hiccup never locks out a doctor mid-visit;
  // token, expiry, revocation and scope checks never fail open.
  return error ? true : Boolean(data);
}

/** The site's own origin as the visitor reached it (works on any Vercel domain without configuration). */
export function originOf(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
