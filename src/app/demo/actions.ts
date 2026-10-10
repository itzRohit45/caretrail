"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/sharing/request";
import { DEMO_PATIENTS, type DemoKey } from "@/lib/demo";

/** "Try demo": a private copy of a seeded demo patient, so visitors never interfere with each other. */
export async function startDemo(form: FormData) {
  const key = String(form.get("patient")) as DemoKey;
  const persona = DEMO_PATIENTS[key];
  if (!persona) redirect("/?demo=unknown");
  if (!(await allowRequest(await headers(), "demo", 10, 3600))) redirect("/?demo=busy");

  const admin = adminClient();
  const { data: template } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", persona.name).maybeSingle();
  if (!template) redirect("/?demo=unavailable");

  const email = `demo-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data: user, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true, name: persona.name } });
  if (error || !user.user) redirect("/?demo=unavailable");
  const { error: cloneError } = await admin.rpc("clone_demo_patient", { p_template: template.id, p_owner: user.user.id });
  if (cloneError) {
    await admin.auth.admin.deleteUser(user.user.id);
    redirect("/?demo=unavailable");
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/home");
}
