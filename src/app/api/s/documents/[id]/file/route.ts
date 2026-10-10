import { z } from "zod";
import { resolveViewer, logAccess } from "@/lib/sharing/resolve";
import { documentAllowed } from "@/lib/brief/build";
import { adminClient } from "@/lib/supabase/admin";
import { fail, forbidden, ok } from "@/lib/api/respond";

/** A 5-minute signed URL for one in-scope document. Anything outside the link's scope is 403 and logged. */
export async function GET(request: Request, ctx: RouteContext<"/api/s/documents/[id]/file">) {
  const res = await resolveViewer(request, "s-file");
  if ("response" in res) return res.response;
  const id = z.uuid().safeParse((await ctx.params).id);
  const doc = id.success ? await documentAllowed(res.ctx.link, id.data) : null;
  if (!doc) {
    await logAccess(res.ctx, { action: "denied_out_of_scope", viewer_name: res.ctx.session.viewer_name, target_id: id.success ? id.data : null });
    return forbidden();
  }
  const { data, error } = await adminClient().storage.from("documents").createSignedUrl(doc.storage_path, 300);
  if (error || !data) return fail(500, "The file could not be opened.");
  await logAccess(res.ctx, { action: "viewed_document", viewer_name: res.ctx.session.viewer_name, target_id: doc.id });
  return ok({ url: data.signedUrl, mime_type: doc.mime_type, expires_in: 300 });
}
