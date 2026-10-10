import { adminClient } from "@/lib/supabase/admin";
import { allowRequest, ipHash } from "@/lib/sharing/request";
import { hashToken, isTokenShape } from "@/lib/sharing/tokens";
import { buildEmergencyCard } from "@/lib/emergency/card";
import { sendEmail } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { accessEnded, ok, tooMany } from "@/lib/api/respond";

const NOTIFY_EVERY_MS = 10 * 60 * 1000;

/** Tier 1 emergency card: no login, critical subset only. Every scan is logged and the patient notified. */
export async function GET(request: Request) {
  if (!(await allowRequest(request, "e-card"))) return tooMany();
  const token = request.headers.get("x-emergency-token");
  if (!isTokenShape(token)) return accessEnded();
  const admin = adminClient();
  const { data: patient } = await admin.from("patients").select("*").eq("emergency_token_hash", hashToken(token)).maybeSingle();
  if (!patient) return accessEnded();

  const { data: recent } = await admin
    .from("access_logs")
    .select("created_at")
    .eq("patient_id", patient.id)
    .eq("action", "emergency_scan")
    .gte("created_at", new Date(Date.now() - NOTIFY_EVERY_MS).toISOString())
    .limit(1);
  await admin.from("access_logs").insert({ patient_id: patient.id, action: "emergency_scan", ip_hash: ipHash(request) });

  // Email the patient (at most once every 10 minutes so repeated scans do not flood them).
  if (!recent?.length) {
    const { data: owner } = await admin.auth.admin.getUserById(patient.owner_user_id);
    const email = owner.user?.email;
    if (email) {
      await sendEmail(
        email,
        "Your CareTrail emergency card was scanned",
        `Your emergency card was scanned on ${formatDateTime(new Date().toISOString())} (IST).\n\nIt showed your blood group, allergies, current medicines, main conditions and emergency contact. If this was not expected, open CareTrail and make a new emergency QR; the old one stops working at once.\n\nCareTrail`,
      );
    }
  }
  return ok(await buildEmergencyCard(patient));
}
