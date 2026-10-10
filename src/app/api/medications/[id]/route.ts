import { z } from "zod";
import { patientForRequest } from "@/lib/auth";
import { cleanBrand } from "@/lib/normalise/brands";
import { todayIST } from "@/lib/format";
import { fail, invalid, ok, unauthorized } from "@/lib/api/respond";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stop") }),
  z.object({
    action: z.literal("edit"),
    dose: z.string().trim().max(60).nullable(),
    frequency: z.string().trim().max(80).nullable(),
  }),
]);
const brandKey = (s: string) => cleanBrand(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Mark a medicine stopped (all active repeat prescriptions of that brand) or correct its dose. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/medications/[id]">) {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "This medicine was not found.");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, patient } = session;

  const { data: med } = await supabase.from("medications").select("id, brand_name").eq("id", id.data).maybeSingle();
  if (!med) return fail(404, "This medicine was not found.");

  if (parsed.data.action === "edit") {
    const { error } = await supabase
      .from("medications")
      .update({ dose: parsed.data.dose, frequency: parsed.data.frequency, verified_by_patient: true })
      .eq("id", med.id);
    return error ? fail(500, "We could not save this change.") : ok({ id: med.id });
  }

  const { data: active } = await supabase.from("medications").select("id, brand_name").eq("patient_id", patient.id).eq("active", true);
  const ids = (active ?? []).filter((m) => brandKey(m.brand_name) === brandKey(med.brand_name)).map((m) => m.id);
  const { error } = await supabase.from("medications").update({ active: false, stopped_on: todayIST() }).in("id", ids.length ? ids : [med.id]);
  return error ? fail(500, "We could not update this medicine.") : ok({ stopped: ids.length || 1 });
}
