import { patientForRequest } from "@/lib/auth";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Access history (insert-only on the server) and who is viewing right now. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const { supabase, patient } = session;
  const [logs, live, links] = await Promise.all([
    supabase.from("access_logs").select("id, share_link_id, viewer_name, viewer_reg_no, viewer_hospital, action, target_id, created_at").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("viewer_sessions").select("id, share_link_id, viewer_name, last_seen_at").eq("patient_id", patient.id).gte("last_seen_at", new Date(Date.now() - 15_000).toISOString()),
    supabase.from("share_links").select("id, label, revoked_at, is_break_glass").eq("patient_id", patient.id),
  ]);
  if (logs.error) return fail(500, "Access history could not load.");
  const active = new Set((links.data ?? []).filter((l) => !l.revoked_at).map((l) => l.id));
  return ok({
    logs: logs.data,
    viewing_now: (live.data ?? []).filter((v) => active.has(v.share_link_id)),
    links: links.data ?? [],
  });
}
