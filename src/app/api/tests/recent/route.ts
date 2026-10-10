import { patientForRequest } from "@/lib/auth";
import { loadTestSaver } from "@/lib/safety/load";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Recent tests with validity windows and next due dates (Test Saver). */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  try {
    return ok(await loadTestSaver(session.supabase, session.patient.id));
  } catch {
    return fail(500, "Recent tests could not load. Please try again.");
  }
}
