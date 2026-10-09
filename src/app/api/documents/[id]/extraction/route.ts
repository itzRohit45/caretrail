import { ownedDocument } from "@/lib/documents/access";
import { reviewPlan } from "@/lib/records/review";
import { loadReference } from "@/lib/records/save";
import { extractionSchema } from "@/lib/extraction/schema";
import { fail, ok, unauthorized } from "@/lib/api/respond";

const STUCK_MS = 3 * 60 * 1000;

/** Extraction result and which fields the patient must check. */
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]/extraction">) {
  const { session, doc } = await ownedDocument((await ctx.params).id);
  if (!session) return unauthorized();
  if (!doc) return fail(404, "This record was not found.");

  // A read that never finished (closed tab, crashed function) becomes a manual-entry document.
  if (doc.extraction_status === "processing" && Date.now() - new Date(doc.created_at).getTime() > STUCK_MS) {
    await session.supabase.from("documents").update({ extraction_status: "failed", extraction_error: "timeout" }).eq("id", doc.id);
    return ok({ status: "failed", extraction: null, review: null });
  }
  const parsed = doc.extraction ? extractionSchema.safeParse(doc.extraction) : null;
  const review = parsed?.success ? reviewPlan(parsed.data, (await loadReference(session.supabase)).index) : null;
  return ok({ status: doc.extraction_status, extraction: parsed?.success ? parsed.data : null, review });
}
