import { resolveWriter, logAccess, doctorUploader } from "@/lib/sharing/resolve";
import { adminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/documents/access";
import { extractDocument } from "@/lib/extraction/run";
import { fail, ok } from "@/lib/api/respond";

export const maxDuration = 60;

/**
 * FR-14: confirms the doctor's upload (re-hashing the stored file) and reads it with the same extraction.
 * It always waits for the patient: they check every medicine and dose before it joins the record.
 */
export async function POST(request: Request, route: RouteContext<"/api/s/documents/[id]/process">) {
  const res = await resolveWriter(request, "s-upload");
  if ("response" in res) return res.response;
  const { ctx } = res;
  const id = (await route.params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(404, "This upload was not found.");
  const admin = adminClient();
  const { data: doc } = await admin.from("documents").select("*").eq("id", id).eq("patient_id", ctx.patient.id).eq("uploaded_by", doctorUploader(ctx.session.viewer_name)).maybeSingle();
  if (!doc) return fail(404, "This upload was not found.");
  if (!["pending", "failed"].includes(doc.extraction_status)) return ok({ status: doc.extraction_status });

  const storage = admin.storage.from("documents");
  const { data: blob, error: downloadError } = await storage.download(doc.storage_path);
  if (downloadError || !blob) return fail(409, "The upload did not finish. Please try again.", { retry_upload: true });
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (doc.upload_status === "pending") {
    if (sha256Hex(bytes) !== doc.file_hash) {
      await storage.remove([doc.storage_path]);
      await admin.from("documents").delete().eq("id", doc.id);
      return fail(422, "The file changed while uploading. Please upload it again.");
    }
    await admin.from("documents").update({ upload_status: "uploaded" }).eq("id", doc.id);
    await logAccess(ctx, { action: "added_document", viewer_name: ctx.session.viewer_name, viewer_reg_no: ctx.session.viewer_reg_no, target_id: doc.id });
  }

  const { data: claimed } = await admin
    .from("documents")
    .update({ extraction_status: "processing", extraction_error: null })
    .eq("id", doc.id)
    .in("extraction_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return ok({ status: "processing" });

  const result = await extractDocument({ hash: doc.file_hash, data: bytes, mimeType: doc.mime_type });
  if (!result.ok) {
    await admin.from("documents").update({ extraction_status: "failed", extraction_error: result.reason }).eq("id", doc.id);
    return ok({ status: "failed" });
  }
  const x = result.data;
  if (!x.is_medical_document) {
    await admin.from("documents").update({ extraction: x, extraction_status: "skipped", type: "other" }).eq("id", doc.id);
    return ok({ status: "skipped" });
  }
  await admin.from("documents").update({ extraction: x, type: x.document_type, extraction_status: "needs_review" }).eq("id", doc.id);
  return ok({ status: "needs_review", medicines: x.medications.length });
}
