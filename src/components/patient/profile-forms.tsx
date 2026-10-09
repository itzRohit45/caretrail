"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { CheckCircle, PencilSimple, Trash, WarningOctagon } from "@phosphor-icons/react";
import { addAllergy, deleteAllergy, saveProfile, updateAllergy, type FormState } from "@/app/(patient)/profile/actions";
import { BLOOD_GROUPS, SEVERITIES } from "@/lib/schemas/profile";
import { ChoiceTiles } from "@/components/ui/choice-tiles";
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
      <section aria-labelledby="about-title" className="rounded-card border border-rule bg-sheet p-5 shadow-card sm:p-7">
        <h2 id="about-title" className="text-title font-bold">About you</h2>
        <div className="mt-5 space-y-6">
          <div className="grid gap-5 sm:grid-cols-[3fr_2fr]">
            <TextField f={{ id: "name", label: "Full name", autoComplete: "name" }} state={state} initial={patient.name} />
            <TextField f={{ id: "dob", label: "Date of birth", type: "date", autoComplete: "bday", optional: true }} state={state} initial={patient.dob} />
          </div>
          <ChoiceTiles
            name="sex"
            legend="Sex"
            columns="grid-cols-3"
            defaultValue={patient.sex}
            error={state.fields?.sex}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other", label: "Other" },
            ]}
          />
          <ChoiceTiles
            name="blood_group"
            legend="Blood group"
            hint="Check an old lab report or blood donation card if you are not sure."
            columns="grid-cols-3 sm:grid-cols-9"
            defaultValue={patient.blood_group}
            error={state.fields?.blood_group}
            options={[
              ...BLOOD_GROUPS.map((g) => ({
                value: g,
                label: <span className="text-lead font-extrabold">{g}</span>,
                srLabel: g.endsWith("+") ? " positive" : " negative",
              })),
              { value: "", label: <span className="text-dense">Not sure</span> },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="contact-title" className="rounded-card border border-rule bg-sheet p-5 shadow-card sm:p-7">
        <h2 id="contact-title" className="text-title font-bold">Emergency contact</h2>
        <p className="mt-1 text-ink-2">Shown on your emergency card so a hospital can call them.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField f={{ id: "emergency_contact_name", label: "Name", autoComplete: "off", optional: true }} state={state} initial={patient.emergency_contact_name} />
          <TextField f={{ id: "emergency_contact_phone", label: "Phone", type: "tel", autoComplete: "off", optional: true }} state={state} initial={patient.emergency_contact_phone} />
          <div className="sm:col-span-2">
            <TextField f={{ id: "emergency_contact_email", label: "Email", type: "email", autoComplete: "off", optional: true, helper: "Alerts about emergency access go here." }} state={state} initial={patient.emergency_contact_email} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <SubmitButton pending={pending} pendingLabel="Saving...">Save details</SubmitButton>
          <Status state={state} />
        </div>
      </section>
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
      <ChoiceTiles
        name="severity"
        legend="How serious is it?"
        columns="grid-cols-3"
        defaultValue={initial?.severity}
        error={err.severity}
        options={SEVERITIES.map((v) => ({
          value: v,
          label: v === "severe" ? (
            <span className="inline-flex items-center gap-1.5"><WarningOctagon aria-hidden weight="fill" className="size-5" />Severe</span>
          ) : (
            <span className="capitalize">{v}</span>
          ),
        }))}
      />
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
