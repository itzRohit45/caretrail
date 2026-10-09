"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema, safeNext } from "@/lib/schemas/auth";

export type AuthState = { message?: string; fields?: Record<string, string>; values?: Record<string, string> };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = { email: String(form.get("email") ?? "") };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      message: error.status === 429 ? "Too many attempts. Wait a minute and try again." : "That email and password do not match.",
      values,
    };
  }
  redirect(safeNext(form.get("next")));
}

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = signupSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return {
      message: taken
        ? "An account with this email already exists. Log in instead."
        : error.status === 429
          ? "Too many sign-ups right now. Wait a minute and try again."
          : "We could not create your account. Please try again.",
      values,
    };
  }
  if (!data.session) {
    return { message: "Account created. Check your email to confirm it, then log in.", values };
  }
  redirect("/home");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
