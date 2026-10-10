import { resolveWriter, logAccess } from "@/lib/sharing/resolve";
import { adminClient } from "@/lib/supabase/admin";
import { doctorNoteSchema } from "@/lib/schemas/shares";
import { fail, invalid, ok } from "@/lib/api/respond";

/** FR-14: the doctor leaves a note in the patient's record (write-back links only). Logged as added_note. */
export async function POST(request: Request) {
  const res = await resolveWriter(request, "s-notes");
  if ("response" in res) return res.response;
  const { ctx } = res;
  const parsed = doctorNoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await adminClient()
    .from("doctor_notes")
    .insert({ share_link_id: ctx.link.id, patient_id: ctx.patient.id, doctor_name: ctx.session.viewer_name, note: parsed.data.note })
    .select("id, doctor_name, note, created_at")
    .single();
  if (error) return fail(500, "The note could not be saved. Please try again.");
  await logAccess(ctx, { action: "added_note", viewer_name: ctx.session.viewer_name, viewer_reg_no: ctx.session.viewer_reg_no, target_id: data.id });
  return ok(data, 201);
}
