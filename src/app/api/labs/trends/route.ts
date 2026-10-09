import { z } from "zod";
import { patientForRequest } from "@/lib/auth";
import { loadTrends, TREND_KEYS } from "@/lib/records/trends";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";

const query = z.object({ test: z.enum(TREND_KEYS).optional() });

/** Series for trend charts: ?test=HbA1c | FBS | BP | TSH | LDL (all when omitted). */
export async function GET(request: Request) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return invalid(parsed.error);
  try {
    return ok(await loadTrends(session.supabase, session.patient.id, parsed.data.test));
  } catch {
    return fail(500, "Trends could not load. Please try again.");
  }
}
