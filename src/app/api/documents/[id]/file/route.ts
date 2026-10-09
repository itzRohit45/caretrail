import { ownedDocument } from "@/lib/documents/access";
import { adminClient } from "@/lib/supabase/admin";
import { fail, ok, unauthorized } from "@/lib/api/respond";

const SIGNED_URL_SECONDS = 300;

/** A 5-minute signed URL for the original file. Files are never public. */
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]/file">) {
  const { session, doc } = await ownedDocument((await ctx.params).id);
  if (!session) return unauthorized();
  if (!doc || doc.upload_status !== "uploaded") return fail(404, "This record was not found.");
  const { data, error } = await adminClient().storage.from("documents").createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
  if (error || !data) return fail(500, "The file could not be opened. Please try again.");
  return ok({ url: data.signedUrl, mime_type: doc.mime_type, expires_in: SIGNED_URL_SECONDS });
}
