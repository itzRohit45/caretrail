import { patientForRequest } from "@/lib/auth";
import { createShareSchema, EXPIRY_OPTIONS } from "@/lib/schemas/shares";
import { hashToken, newOtp, newToken } from "@/lib/sharing/tokens";
import { originOf } from "@/lib/sharing/request";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";

const LIVE_MS = 15_000;

/** Create a scoped, expiring link. The URL (with its token) is returned once and never stored. */
export async function POST(request: Request) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const parsed = createShareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const s = parsed.data;
  const token = newToken();
  const otp = s.require_otp ? newOtp() : null;
  const { data, error } = await session.supabase
    .from("share_links")
    .insert({
      patient_id: session.patient.id,
      token_hash: hashToken(token),
      label: s.label ?? null,
      scope_type: s.scope_type,
      scope_conditions: s.scope_type === "conditions" ? s.scope_conditions : [],
      scope_months: s.scope_type === "months" ? s.scope_months : null,
      expires_at: new Date(Date.now() + EXPIRY_OPTIONS[s.expires_in]).toISOString(),
      require_otp: s.require_otp,
      otp_code: otp,
    })
    .select("id, expires_at")
    .single();
  if (error) return fail(500, "The link could not be created. Please try again.");
  // The token lives in the URL fragment, which browsers never send to servers, so it stays out of request logs.
  return ok({ id: data.id, url: `${originOf(request)}/s#${token}`, otp_code: otp, expires_at: data.expires_at }, 201);
}

/** Links with status, view counts and who is viewing right now. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const { supabase, patient } = session;
  const [links, logs, live] = await Promise.all([
    supabase.from("share_links").select("id, label, scope_type, scope_conditions, scope_months, expires_at, revoked_at, require_otp, otp_code, is_break_glass, created_at").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    supabase.from("access_logs").select("share_link_id, action").eq("patient_id", patient.id).in("action", ["opened", "break_glass"]),
    supabase.from("viewer_sessions").select("share_link_id, viewer_name, last_seen_at").eq("patient_id", patient.id).gte("last_seen_at", new Date(Date.now() - LIVE_MS).toISOString()),
  ]);
  if (links.error) return fail(500, "Your links could not load.");
  const now = Date.now();
  return ok(
    links.data.map((l) => ({
      ...l,
      status: l.revoked_at ? "revoked" : new Date(l.expires_at).getTime() <= now ? "expired" : "active",
      views: (logs.data ?? []).filter((x) => x.share_link_id === l.id).length,
      viewing_now: (live.data ?? []).filter((v) => v.share_link_id === l.id && !l.revoked_at).map((v) => v.viewer_name),
      otp_code: l.revoked_at || new Date(l.expires_at).getTime() <= now ? null : l.otp_code,
    })),
  );
}
