import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { hashToken, isTokenShape } from "./tokens";
import { allowRequest, ipHash } from "./request";
import { accessEnded, tooMany, fail } from "@/lib/api/respond";
import type { Row } from "@/lib/db/types";

export type ShareContext = { link: Row<"share_links">; patient: Row<"patients">; ip: string };

/**
 * The single gate for every token request: rate limit, then token shape, hash lookup, expiry and
 * revocation, all re-checked on each call. Unknown, expired and revoked tokens get the same 410.
 */
export async function resolveShare(request: Request, bucket: string, limit = 30): Promise<{ ctx: ShareContext } | { response: Response }> {
  if (!(await allowRequest(request, bucket, limit))) return { response: tooMany() };
  const token = request.headers.get("x-share-token");
  if (!isTokenShape(token)) return { response: accessEnded() };
  const admin = adminClient();
  const { data: link } = await admin.from("share_links").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return { response: accessEnded() };
  const { data: patient } = await admin.from("patients").select("*").eq("id", link.patient_id).maybeSingle();
  if (!patient) return { response: accessEnded() };
  return { ctx: { link, patient, ip: ipHash(request) } };
}

/** Also requires an opened viewer session belonging to this link (name entered, code checked). */
/** The 5 s keep-alive gets a larger allowance (several doctors can share one office IP). */
export async function resolveViewer(request: Request, bucket: string, limit = 30) {
  const res = await resolveShare(request, bucket, limit);
  if ("response" in res) return res;
  const sessionId = request.headers.get("x-viewer-session");
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) return { response: fail(401, "Enter your name to open these records.") };
  const { data: session } = await adminClient().from("viewer_sessions").select("*").eq("id", sessionId).eq("share_link_id", res.ctx.link.id).maybeSingle();
  if (!session) return { response: fail(401, "Enter your name to open these records.") };
  return { ctx: { ...res.ctx, session } };
}

export async function logAccess(ctx: ShareContext, entry: { action: string; viewer_name?: string | null; target_id?: string | null }) {
  await adminClient().from("access_logs").insert({
    patient_id: ctx.patient.id,
    share_link_id: ctx.link.id,
    viewer_name: entry.viewer_name ?? null,
    action: entry.action,
    target_id: entry.target_id ?? null,
    ip_hash: ctx.ip,
  });
}
