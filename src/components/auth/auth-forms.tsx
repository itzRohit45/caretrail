"use client";

import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/(auth)/actions";
import { Field, inputClass, describedBy } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

function FormMessage({ state }: { state: AuthState }) {
  if (!state.message) return null;
  return (
    <p role="alert" className="rounded-control bg-severe-soft px-4 py-3 font-semibold text-severe">
      {state.message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? "/home"} />
      <FormMessage state={state} />
      <Field id="email" label="Email" error={f.email}>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email}
          aria-invalid={Boolean(f.email)} aria-describedby={describedBy("email", undefined, f.email)} className={inputClass} />
      </Field>
      <Field id="password" label="Password" error={f.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          aria-invalid={Boolean(f.password)} aria-describedby={describedBy("password", undefined, f.password)} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Logging in..." className="w-full">Log in</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field id="name" label="Your name" error={f.name}>
        <input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name}
          aria-invalid={Boolean(f.name)} aria-describedby={describedBy("name", undefined, f.name)} className={inputClass} />
      </Field>
      <Field id="email" label="Email" error={f.email}>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email}
          aria-invalid={Boolean(f.email)} aria-describedby={describedBy("email", undefined, f.email)} className={inputClass} />
      </Field>
      <Field id="password" label="Password" helper="At least 8 characters." error={f.password}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          aria-invalid={Boolean(f.password)} aria-describedby={describedBy("password", "help", f.password)} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating account..." className="w-full">Create account</SubmitButton>
    </form>
  );
}
