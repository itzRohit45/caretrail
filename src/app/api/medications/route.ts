import { patientForRequest } from "@/lib/auth";
import { loadMedicines } from "@/lib/safety/load";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Active medicines (repeat prescriptions grouped) and stopped history. */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  try {
    const { groups, stopped, unrecognised } = await loadMedicines(session.supabase, session.patient.id);
    return ok({ active: groups, stopped, unrecognised: unrecognised.map((g) => g.current.brand_name) });
  } catch {
    return fail(500, "Your medicines could not load. Please try again.");
  }
}
