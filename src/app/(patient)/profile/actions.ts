"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allergySchema, profileSchema } from "@/lib/schemas/profile";

export type FormState = { ok?: boolean; message?: string; fields?: Record<string, string> };

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const { patient } = await requirePatient();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues), message: "Please fix the highlighted fields." };

  const supabase = await createClient();
  const { error } = await supabase.from("patients").update(parsed.data).eq("id", patient.id);
  if (error) return { message: "We could not save your details. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function addAllergy(_prev: FormState, form: FormData): Promise<FormState> {
  const { patient } = await requirePatient();
  const parsed = allergySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("allergies").insert({ ...parsed.data, patient_id: patient.id });
  if (error) return { message: "We could not add this allergy. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: `Added ${parsed.data.substance}.` };
}

const idSchema = z.uuid();

export async function updateAllergy(_prev: FormState, form: FormData): Promise<FormState> {
  const { patient } = await requirePatient();
  const id = idSchema.safeParse(form.get("id"));
  const parsed = allergySchema.safeParse(Object.fromEntries(form));
  if (!id.success) return { message: "This allergy no longer exists." };
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("allergies").update(parsed.data).eq("id", id.data).eq("patient_id", patient.id);
  if (error) return { message: "We could not save this change. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function deleteAllergy(form: FormData) {
  const { patient } = await requirePatient();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("allergies").delete().eq("id", id.data).eq("patient_id", patient.id);
  revalidatePath("/", "layout");
}
