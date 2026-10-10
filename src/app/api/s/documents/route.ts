import { resolveWriter, doctorUploader } from "@/lib/sharing/resolve";
import { adminClient } from "@/lib/supabase/admin";
import { createDocumentSchema, MAX_UPLOAD_BYTES } from "@/lib/schemas/documents";
import { fail, invalid, ok } from "@/lib/api/respond";

const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;
const doctorUploadSchema = createDocumentSchema.omit({ type: true });

/** FR-14: the doctor starts a prescription upload into the patient's private storage (write-back links only). */
export async function POST(request: Request) {
  const res = await resolveWriter(request, "s-upload");
  if ("response" in res) return res.response;
  const { ctx } = res;
  const body = await request.json().catch(() => null);
  const size = typeof body?.size_bytes === "number" ? body.size_bytes : 0;
  if (size > MAX_UPLOAD_BYTES) return fail(413, `Files can be up to 10 MB. This one is ${(size / 1048576).toFixed(1)} MB.`);
  const parsed = doctorUploadSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const admin = adminClient();
  const uploader = doctorUploader(ctx.session.viewer_name);

  const { data: existing } = await admin.from("documents").select("id, upload_status, uploaded_by, storage_path").eq("patient_id", ctx.patient.id).eq("file_hash", input.file_hash).maybeSingle();
  if (existing?.upload_status === "uploaded") return fail(409, "This file is already in the patient's record.");
  if (existing && existing.uploaded_by !== uploader) return fail(409, "This file is already being added to the patient's record.");

  let doc = existing;
  if (!doc) {
    const id = crypto.randomUUID();
    const { data, error } = await admin
      .from("documents")
      .insert({
        id,
        patient_id: ctx.patient.id,
        type: "prescription",
        file_hash: input.file_hash,
        storage_path: `${ctx.patient.id}/${id}.${EXT[input.mime_type]}`,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        original_filename: input.original_filename ?? null,
        uploaded_by: uploader,
      })
      .select("id, upload_status, uploaded_by, storage_path")
      .single();
    if (error) return fail(500, "The upload could not start. Please try again.");
    doc = data;
  }
  const { data: signed, error } = await admin.storage.from("documents").createSignedUploadUrl(doc.storage_path, { upsert: true });
  if (error || !signed) return fail(500, "The upload could not start. Please try again.");
  return ok({ document_id: doc.id, upload_url: signed.signedUrl }, 201);
}
