import { ownedDocument, sha256Hex } from "@/lib/documents/access";
import { adminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/extraction/run";
import { reviewPlan } from "@/lib/records/review";
import { loadReference, payloadFromExtraction, saveFacts } from "@/lib/records/save";
import { fail, ok, unauthorized } from "@/lib/api/respond";

export const maxDuration = 60;

const notFound = () => fail(404, "This record was not found.");

/**
 * Confirms the upload (re-hashing the stored file), reads it once, and routes it:
 * confident documents are saved straight away, anything else waits for the patient.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/documents/[id]/process">) {
  const { session, doc } = await ownedDocument((await ctx.params).id);
  if (!session) return unauthorized();
  if (!doc) return notFound();
  const { supabase } = session;
  if (!["pending", "failed"].includes(doc.extraction_status)) return ok({ status: doc.extraction_status });

  const storage = adminClient().storage.from("documents");
  const { data: blob, error: downloadError } = await storage.download(doc.storage_path);
  if (downloadError || !blob) return fail(409, "The upload did not finish. Please try again.", { retry_upload: true });
  const bytes = Buffer.from(await blob.arrayBuffer());

  if (doc.upload_status === "pending") {
    if (sha256Hex(bytes) !== doc.file_hash) {
      await storage.remove([doc.storage_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
      return fail(422, "The file changed while uploading. Please upload it again.");
    }
    await supabase.from("documents").update({ upload_status: "uploaded" }).eq("id", doc.id);
  }

  // Claim: only one request reads a given document.
  const { data: claimed } = await supabase
    .from("documents")
    .update({ extraction_status: "processing", extraction_error: null })
    .eq("id", doc.id)
    .in("extraction_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return ok({ status: "processing" });

  const result = await extractDocument({ hash: doc.file_hash, data: bytes, mimeType: doc.mime_type });
  if (!result.ok) {
    await supabase.from("documents").update({ extraction_status: "failed", extraction_error: result.reason }).eq("id", doc.id);
    return ok({ status: "failed", reason: result.reason });
  }

  const x = result.data;
  if (!x.is_medical_document) {
    await supabase.from("documents").update({ extraction: x, extraction_status: "skipped", type: "other" }).eq("id", doc.id);
    return ok({ status: "skipped" });
  }

  const ref = await loadReference(supabase);
  const plan = reviewPlan(x, ref.index);
  const type = doc.type === "other" ? x.document_type : doc.type;
  if (plan.needsReview) {
    await supabase.from("documents").update({ extraction: x, type, extraction_status: "needs_review" }).eq("id", doc.id);
    return ok({ status: "needs_review" });
  }

  const { data: fresh } = await supabase
    .from("documents")
    .update({ extraction: x, type, verified_at: new Date().toISOString() })
    .eq("id", doc.id)
    .is("verified_at", null)
    .select("*")
    .maybeSingle();
  if (!fresh) return ok({ status: "completed" });
  try {
    await saveFacts(supabase, fresh, payloadFromExtraction(x), ref);
  } catch {
    await supabase.from("documents").update({ extraction_status: "needs_review", verified_at: null }).eq("id", doc.id);
    return ok({ status: "needs_review" });
  }
  return ok({ status: "completed" });
}
