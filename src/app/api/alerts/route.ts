import { cookies } from "next/headers";
import { patientForRequest } from "@/lib/auth";
import { DISMISS_COOKIE, loadAlerts, parseDismissed } from "@/lib/alerts";
import { loadMedicines } from "@/lib/safety/load";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** The alert centre: every current alert, and which ones the patient has dismissed on this device. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  try {
    const meds = await loadMedicines(session.supabase, session.patient.id);
    const alerts = await loadAlerts(session.supabase, session.patient.id, meds.warnings);
    const dismissed = parseDismissed((await cookies()).get(DISMISS_COOKIE)?.value);
    return ok({ alerts: alerts.map((a) => ({ ...a, dismissed: dismissed.has(a.id) })) });
  } catch {
    return fail(500, "Alerts could not load.");
  }
}
