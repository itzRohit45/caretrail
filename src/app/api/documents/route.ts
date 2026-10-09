import { patientForRequest } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { createDocumentSchema, MAX_UPLOAD_BYTES } from "@/lib/schemas/documents";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";
import { formatDate } from "@/lib/format";

const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;

/** Registers an upload: duplicate check by hash, then a signed URL so the browser uploads straight to private storage. */
export async function POST(request: Request) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const body = await request.json().catch(() => null);
  const size = typeof body?.size_bytes === "number" ? body.size_bytes : 0;
  if (size > MAX_UPLOAD_BYTES) return fail(413, `Files can be up to 10 MB. This one is ${(size / 1048576).toFixed(1)} MB.`);
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const { supabase, patient } = session;

  const { data: existing } = await supabase
    .from("documents")
    .select("id, created_at, upload_status, storage_path")
    .eq("patient_id", patient.id)
    .eq("file_hash", input.file_hash)
    .maybeSingle();
  if (existing?.upload_status === "uploaded") {
    return fail(409, `Already uploaded on ${formatDate(existing.created_at)}.`, { duplicate: { id: existing.id, uploaded_at: existing.created_at } });
  }

  let doc = existing;
  if (!doc) {
    const id = crypto.randomUUID();
    const { data, error } = await supabase
      .from("documents")
      .insert({
        id,
        patient_id: patient.id,
        type: input.type,
        file_hash: input.file_hash,
        storage_path: `${patient.id}/${id}.${EXT[input.mime_type]}`,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        original_filename: input.original_filename ?? null,
      })
      .select("id, created_at, upload_status, storage_path")
      .single();
    if (error) return fail(500, "We could not start the upload. Please try again.");
    doc = data;
  }

  // Retrying an interrupted upload reuses the same record and overwrites any partial object.
  const { data: signed, error } = await adminClient().storage.from("documents").createSignedUploadUrl(doc.storage_path, { upsert: true });
  if (error || !signed) return fail(500, "We could not start the upload. Please try again.");
  return ok({ document_id: doc.id, upload_url: signed.signedUrl }, 201);
}
