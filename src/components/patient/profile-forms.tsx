"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { CheckCircle, PencilSimple, Trash, WarningOctagon } from "@phosphor-icons/react";
import { addAllergy, deleteAllergy, saveProfile, updateAllergy, type FormState } from "@/app/(patient)/profile/actions";
import { BLOOD_GROUPS, SEVERITIES } from "@/lib/schemas/profile";
import { Field, inputClass, describedBy } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Row } from "@/lib/db/types";

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return state.ok ? (
    <p role="status" className="flex items-center gap-2 font-semibold text-verified">
      <CheckCircle aria-hidden weight="fill" className="size-5" />
      {state.message}
    </p>
  ) : (
    <p role="alert" className="rounded-control bg-severe-soft px-4 py-3 font-semibold text-severe">
      {state.message}
    </p>
  );
}

type Input = { id: string; label: string; type?: string; autoComplete?: string; helper?: string; optional?: boolean };

function TextField({ f, state, initial }: { f: Input; state: FormState; initial: string | null }) {
  const err = state.fields?.[f.id];
  return (
    <Field id={f.id} label={f.label} helper={f.helper} error={err} optional={f.optional}>
      <input id={f.id} name={f.id} type={f.type ?? "text"} autoComplete={f.autoComplete}
        defaultValue={initial ?? ""} aria-invalid={Boolean(err)}
        aria-describedby={describedBy(f.id, f.helper, err)} className={inputClass} />
    </Field>
  );
}

export function ProfileForm({ patient }: { patient: Row<"patients"> }) {
  const { state, onSubmit, pending } = useFormAction(saveProfile, {} as FormState);
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-5">
        <legend className="mb-4 text-title font-bold">About you</legend>
        <TextField f={{ id: "name", label: "Full name", autoComplete: "name" }} state={state} initial={patient.name} />
        <TextField f={{ id: "dob", label: "Date of birth", type: "date", autoComplete: "bday", optional: true }} state={state} initial={patient.dob} />
        <div className="grid grid-cols-2 gap-4">
          <Field id="sex" label="Sex" optional error={state.fields?.sex}>
            <select id="sex" name="sex" defaultValue={patient.sex ?? ""} className={inputClass}>
              <option value="">Not set</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field id="blood_group" label="Blood group" error={state.fields?.blood_group}>
            <select id="blood_group" name="blood_group" defaultValue={patient.blood_group ?? ""} className={inputClass}>
              <option value="">Not sure</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-5">
        <legend className="mb-1 text-title font-bold">Emergency contact</legend>
        <p className="text-ink-2">Shown on your emergency card so a hospital can call them.</p>
        <TextField f={{ id: "emergency_contact_name", label: "Name", autoComplete: "off", optional: true }} state={state} initial={patient.emergency_contact_name} />
        <TextField f={{ id: "emergency_contact_phone", label: "Phone", type: "tel", autoComplete: "off", optional: true }} state={state} initial={patient.emergency_contact_phone} />
        <TextField f={{ id: "emergency_contact_email", label: "Email", type: "email", autoComplete: "off", optional: true, helper: "Alerts about emergency access go here." }} state={state} initial={patient.emergency_contact_email} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Saving...">Save details</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

function AllergyFields({ state, initial, idPrefix }: { state: FormState; initial?: Row<"allergies">; idPrefix: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const err = state.fields ?? {};
  return (
    <>
      <Field id={id("substance")} label="Allergic to" helper="A medicine, food or other substance, for example Penicillin." error={err.substance}>
        <input id={id("substance")} name="substance" defaultValue={initial?.substance ?? ""}
          aria-invalid={Boolean(err.substance)} aria-describedby={describedBy(id("substance"), "help", err.substance)} className={inputClass} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="font-semibold">How serious is it?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SEVERITIES.map((s) => (
            <label key={s} className="flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-control border border-rule-strong bg-sheet font-semibold capitalize has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary">
              <input type="radio" name="severity" value={s} defaultChecked={initial?.severity === s} className="size-4 accent-primary" />
              {s}
            </label>
          ))}
        </div>
        {err.severity ? <p className="font-semibold text-severe">{err.severity}</p> : null}
      </fieldset>
      <Field id={id("reaction")} label="What happens" optional error={err.reaction}>
        <input id={id("reaction")} name="reaction" defaultValue={initial?.reaction ?? ""} className={inputClass} />
      </Field>
    </>
  );
}

export function AddAllergyForm() {
  const { state, onSubmit, pending } = useFormAction(addAllergy, {} as FormState);
  const form = useRef<HTMLFormElement>(null);
  // Clear only after a successful add; a failed add keeps what was typed.
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-5" noValidate>
      <AllergyFields state={state} idPrefix="new" />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Adding..." variant="secondary">Add allergy</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

function SeverityLabel({ severity }: { severity: string }) {
  return severity === "severe" ? (
    <span className="inline-flex items-center gap-1 font-semibold text-severe">
      <WarningOctagon aria-hidden weight="fill" className="size-5" /> Severe
    </span>
  ) : (
    <span className="font-semibold capitalize text-ink-2">{severity}</span>
  );
}

export function AllergyItem({ allergy }: { allergy: Row<"allergies"> }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { state, onSubmit, pending } = useFormAction(async (prev: FormState, form: FormData) => {
    const next = await updateAllergy(prev, form);
    if (next.ok) setEditing(false);
    return next;
  }, {} as FormState);

  if (editing) {
    return (
      <li className="py-4">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <input type="hidden" name="id" value={allergy.id} />
          <AllergyFields state={state} initial={allergy} idPrefix={allergy.id} />
          <div className="flex flex-wrap gap-3">
            <SubmitButton pending={pending} pendingLabel="Saving..." size="dense">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("quiet", "dense")}>Cancel</button>
          </div>
          <Status state={state} />
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="text-lead font-bold">{allergy.substance}</p>
        <p className="flex flex-wrap gap-x-3">
          <SeverityLabel severity={allergy.severity} />
          {allergy.reaction ? <span className="text-ink-2">{allergy.reaction}</span> : null}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("quiet", "dense")}>
          <PencilSimple aria-hidden className="size-5" /> Edit
        </button>
        {confirming ? (
          <form action={deleteAllergy} className="flex gap-2">
            <input type="hidden" name="id" value={allergy.id} />
            <button type="submit" className={buttonClass("danger", "dense")}>Remove {allergy.substance}</button>
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass("quiet", "dense")}>Keep</button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={cn(buttonClass("quiet", "dense"), "text-severe hover:bg-severe-soft")}>
            <Trash aria-hidden className="size-5" /> Remove
          </button>
        )}
      </div>
    </li>
  );
}
