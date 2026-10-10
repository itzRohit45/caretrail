import { patientForRequest } from "@/lib/auth";
import { loadMedicines } from "@/lib/safety/load";
import { SAFETY_NOTE } from "@/lib/safety/engine";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Duplicate therapy, interaction and allergy warnings across all prescribers. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  try {
    const { warnings, unrecognised } = await loadMedicines(session.supabase, session.patient.id);
    return ok({ warnings, note: SAFETY_NOTE, not_checked: unrecognised.map((g) => g.current.brand_name) });
  } catch {
    return fail(500, "Safety checks could not load. Please try again.");
  }
}
