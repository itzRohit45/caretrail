import { resolveViewer } from "@/lib/sharing/resolve";
import { adminClient } from "@/lib/supabase/admin";
import { ok } from "@/lib/api/respond";

/** Polled every 5 s by the doctor's page. 410 as soon as the link is revoked or expires. */
export async function GET(request: Request) {
  const res = await resolveViewer(request, "s-heartbeat", 120);
  if ("response" in res) return res.response;
  await adminClient().from("viewer_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", res.ctx.session.id);
  return ok({ expires_at: res.ctx.link.expires_at });
}
