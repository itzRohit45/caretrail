import { ownedDocument } from "@/lib/documents/access";
import { loadReference, saveFacts } from "@/lib/records/save";
import { verifySchema } from "@/lib/schemas/verify";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";

/** Saves the fields the patient accepted or corrected (or entered by hand after a failed read). */
export async function POST(request: Request, ctx: RouteContext<"/api/documents/[id]/verify">) {
  const { session, doc } = await ownedDocument((await ctx.params).id);
  if (!session) return unauthorized();
  if (!doc) return fail(404, "This record was not found.");
  if (!["needs_review", "failed"].includes(doc.extraction_status)) return fail(409, "This record is already saved.");

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  // Claim before writing so a double tap cannot save the same facts twice.
  const { data: claimed } = await session.supabase
    .from("documents")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", doc.id)
    .is("verified_at", null)
    .select("*")
    .maybeSingle();
  if (!claimed) return fail(409, "This record is already saved.");

  try {
    const counts = await saveFacts(session.supabase, claimed, parsed.data, await loadReference(session.supabase));
    return ok({ status: "completed", ...counts });
  } catch {
    await session.supabase.from("documents").update({ verified_at: null }).eq("id", doc.id);
    return fail(500, "We could not save this record. Please try again.");
  }
}
