import { patientForRequest } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { hashToken, newToken } from "@/lib/sharing/tokens";
import { serverEnv } from "@/lib/env";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Is an emergency QR active, and since when. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  return ok({ active: Boolean(session.patient.emergency_token_hash), created_at: session.patient.emergency_token_created_at });
}

/** Create or regenerate the emergency QR. The old one stops working at once. The URL is returned once. */
export async function POST() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const token = newToken();
  // The token hash column is not writable by the patient's own session (column grants), so the server writes it.
  const { error } = await adminClient()
    .from("patients")
    .update({ emergency_token_hash: hashToken(token), emergency_token_created_at: new Date().toISOString() })
    .eq("id", session.patient.id)
    .eq("owner_user_id", session.userId);
  if (error) return fail(500, "Your emergency QR could not be created. Please try again.");
  return ok({ url: `${serverEnv().NEXT_PUBLIC_APP_URL}/e#${token}` }, 201);
}
