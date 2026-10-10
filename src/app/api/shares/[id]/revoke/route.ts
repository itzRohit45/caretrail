import { z } from "zod";
import { patientForRequest } from "@/lib/auth";
import { fail, ok, unauthorized } from "@/lib/api/respond";

/** Ends access immediately. The doctor's open page sees 410 on its next heartbeat (within 5 s). */
export async function POST(_request: Request, ctx: RouteContext<"/api/shares/[id]/revoke">) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "This link was not found.");
  const { data, error } = await session.supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(500, "The link could not be ended. Please try again.");
  return ok({ id: data?.id ?? id.data, revoked: true });
}
