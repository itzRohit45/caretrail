import { resolveShare, logAccess } from "@/lib/sharing/resolve";
import { adminClient } from "@/lib/supabase/admin";
import { openShareSchema } from "@/lib/schemas/shares";
import { fail, invalid, ok } from "@/lib/api/respond";

const MAX_OTP_ATTEMPTS = 5;

/** Doctor enters their name (and the patient's code if required). Opens a viewer session and logs it. */
export async function POST(request: Request) {
  const res = await resolveShare(request, "s-open");
  if ("response" in res) return res.response;
  const { ctx } = res;
  const parsed = openShareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const admin = adminClient();

  if (ctx.link.require_otp) {
    if (ctx.link.otp_failed_attempts >= MAX_OTP_ATTEMPTS) return fail(403, "Too many wrong codes. Ask the patient for a new link.");
    if (parsed.data.otp !== ctx.link.otp_code) {
      await admin.from("share_links").update({ otp_failed_attempts: ctx.link.otp_failed_attempts + 1 }).eq("id", ctx.link.id);
      await logAccess(ctx, { action: "otp_failed", viewer_name: parsed.data.viewer_name });
      return fail(403, "That code does not match. Ask the patient to read it again.");
    }
  }

  const { data: session, error } = await admin
    .from("viewer_sessions")
    .insert({ share_link_id: ctx.link.id, patient_id: ctx.patient.id, viewer_name: parsed.data.viewer_name })
    .select("id")
    .single();
  if (error) return fail(500, "Could not open the records. Please try again.");
  await logAccess(ctx, { action: "opened", viewer_name: parsed.data.viewer_name });
  return ok({ session_id: session.id, expires_at: ctx.link.expires_at });
}
