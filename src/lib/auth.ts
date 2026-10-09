import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/lib/db/types";

/** The logged-in user and their patient profile, or a redirect to login. Cached per request. */
export const requirePatient = cache(async (): Promise<{ userId: string; patient: Row<"patients"> }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!patient) redirect("/login?error=no-profile");
  return { userId, patient };
});

/** For route handlers: null instead of a redirect, so the handler can answer 401. */
export async function patientForRequest() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return patient ? { supabase, userId, patient } : null;
}
