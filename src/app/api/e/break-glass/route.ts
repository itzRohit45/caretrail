import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { allowRequest, ipHash } from "@/lib/sharing/request";
import { hashToken, isTokenShape, newToken } from "@/lib/sharing/tokens";
import { previousVisit } from "@/lib/sharing/resolve";
import { breakGlassSchema } from "@/lib/schemas/shares";
import { sendEmail } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { accessEnded, fail, invalid, ok, tooMany } from "@/lib/api/respond";

const FULL_ACCESS_MS = 2 * 60 * 60 * 1000;

/**
 * Tier 2 break-glass (FR-12): a clinician who names themselves, their hospital and their registration
 * number gets the full record for 2 hours. Logged as break_glass (insert-only, cannot be hidden) and
 * the emergency contact and patient are emailed at once.
 */
export async function POST(request: Request) {
  if (!(await allowRequest(request, "e-break-glass", 30, 3600))) return tooMany();
  const token = request.headers.get("x-emergency-token");
  if (!isTokenShape(token)) return accessEnded();
  const parsed = breakGlassSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const { viewer_name, hospital, reg_no } = parsed.data;

  const admin = adminClient();
  const { data: patient } = await admin.from("patients").select("*").eq("emergency_token_hash", hashToken(token)).maybeSingle();
  if (!patient) return accessEnded();

  const shareToken = newToken();
  const { data: link, error } = await admin
    .from("share_links")
    .insert({
      patient_id: patient.id,
      token_hash: hashToken(shareToken),
      label: `Emergency access: ${hospital}`.slice(0, 80),
      scope_type: "all",
      expires_at: new Date(Date.now() + FULL_ACCESS_MS).toISOString(),
      is_break_glass: true,
    })
    .select("id, expires_at")
    .single();
  if (error) return fail(500, "Could not open the full record. Please try again.");

  const { data: session, error: sessionError } = await admin
    .from("viewer_sessions")
    .insert({ share_link_id: link.id, patient_id: patient.id, viewer_name, viewer_reg_no: reg_no, previous_visit_at: await previousVisit(patient, viewer_name, reg_no) })
    .select("id")
    .single();
  if (sessionError) return fail(500, "Could not open the full record. Please try again.");
  await admin.from("access_logs").insert({
    patient_id: patient.id,
    share_link_id: link.id,
    viewer_name,
    viewer_hospital: hospital,
    viewer_reg_no: reg_no,
    action: "break_glass",
    ip_hash: ipHash(request),
  });

  const when = formatDateTime(new Date().toISOString());
  const until = formatDateTime(link.expires_at);
  const who = `${viewer_name} (${hospital}, registration number ${reg_no})`;
  const { data: owner } = await admin.auth.admin.getUserById(patient.owner_user_id);
  // Emails go out after the response, so the clinician is never kept waiting on the mail service.
  const alerts: (() => Promise<boolean>)[] = [];
  if (patient.emergency_contact_email) {
    const to = patient.emergency_contact_email;
    alerts.push(() =>
      sendEmail(
        to,
        `Emergency access to ${patient.name}'s medical record`,
        `${who} opened ${patient.name}'s full medical record through their CareTrail emergency card on ${when} (IST).\n\nYou are receiving this because ${patient.name} listed you as their emergency contact. Access ends automatically at ${until}.\n\nCareTrail`,
      ),
    );
  }
  const ownerEmail = owner.user?.email;
  if (ownerEmail) {
    alerts.push(() =>
      sendEmail(
        ownerEmail,
        "Emergency full access to your CareTrail record",
        `${who} used emergency full access to your record on ${when} (IST). It ends automatically at ${until}.\n\nYou can end it earlier from Sharing in CareTrail. The access is recorded in your access history and cannot be removed.\n\nCareTrail`,
      ),
    );
  }
  after(() => Promise.all(alerts.map((send) => send())));

  return ok({ token: shareToken, session_id: session.id, expires_at: link.expires_at, contact_alerted: Boolean(patient.emergency_contact_email) });
}
