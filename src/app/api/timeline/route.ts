import { patientForRequest } from "@/lib/auth";
import { loadTimeline, timelineFilterSchema } from "@/lib/records/timeline";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";

/** Timeline events with filters: condition, type, months or from/to. */
export async function GET(request: Request) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = timelineFilterSchema.safeParse(params);
  if (!filters.success) return invalid(filters.error);
  try {
    return ok(await loadTimeline(session.supabase, session.patient.id, filters.data));
  } catch {
    return fail(500, "Your records could not load. Please try again.");
  }
}
