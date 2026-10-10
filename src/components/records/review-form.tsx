"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Question, Trash, ArrowCounterClockwise, Plus, Quotes, Prescription, Flask, Stethoscope, WarningOctagon, CircleNotch } from "@phosphor-icons/react";
import { decodeFrequency } from "@/lib/normalise/frequency";
import { MANUAL_SOURCE, type ReviewCondition, type ReviewLab, type ReviewMed, type ReviewModel } from "@/lib/records/view";
import type { CheckReason } from "@/lib/records/review";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Item<T> = T & { key: string; removed: boolean; manual: boolean; original: T };

const REASON_TEXT: Record<CheckReason, string> = {
  dose: "Check the dose and how often against your paper.",
  low_confidence: "We were not sure we read this correctly.",
  unrecognised: "We do not recognise this medicine name. It will be kept exactly as written and left out of interaction checks.",
};

const label = "mb-1 block text-dense font-semibold text-ink-2";
const smallInput = cn(inputClass, "min-h-12 text-body");

function wrap<T extends object>(list: T[]): Item<T>[] {
  return list.map((t, i) => ({ ...t, key: `${i}`, removed: false, manual: false, original: t }));
}
function changed<T extends object>(item: Item<T>, fields: (keyof T)[]) {
  return fields.some((f) => String(item[f] ?? "") !== String(item.original[f] ?? ""));
}

function Flag({ reasons }: { reasons: CheckReason[] }) {
  if (!reasons.length) return null;
  return (
    <div className="flex gap-2 rounded-control bg-verify-soft px-3 py-2 text-dense text-verify">
      <Question aria-hidden weight="bold" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-bold">Check this</p>
        {reasons.map((r) => (
          <p key={r}>{REASON_TEXT[r]}</p>
        ))}
      </div>
    </div>
  );
}

function Source({ text }: { text: string }) {
  if (text === MANUAL_SOURCE) return <p className="text-meta text-ink-3">Added by you</p>;
  return (
    <p className="flex gap-2 text-meta text-ink-2">
      <Quotes aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 text-ink-3" />
      <span>
        On the document: <span className="font-mono text-ink">{text}</span>
      </span>
    </p>
  );
}

function Removed({ name, onUndo }: { name: string; onUndo: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control border border-dashed border-rule-strong px-4 py-3 text-ink-2">
      <span>
        <span className="font-semibold line-through">{name || "Item"}</span> will not be saved
      </span>
      <button type="button" onClick={onUndo} className={buttonClass("quiet", "dense")}>
        <ArrowCounterClockwise aria-hidden className="size-5" /> Undo
      </button>
    </li>
  );
}

function RemoveButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(buttonClass("quiet", "dense"), "text-severe hover:bg-severe-soft")} aria-label={`Remove ${name || "this item"}`}>
      <Trash aria-hidden className="size-5" /> Remove
    </button>
  );
}

function SectionTitle({ Icon, title, count, flagged }: { Icon: typeof Flask; title: string; count: number; flagged: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-pill bg-primary-soft text-primary">
        <Icon aria-hidden weight="duotone" className="size-5" />
      </span>
      <h2 className="text-title font-bold">{title}</h2>
      <span className="text-ink-2">
        {count} found{flagged ? `, ${flagged} to check` : ""}
      </span>
    </div>
  );
}

export function ReviewForm({ model }: { model: ReviewModel }) {
  const router = useRouter();
  const [docDate, setDocDate] = useState(model.doc_date ?? "");
  const [facility, setFacility] = useState(model.facility);
  const [doctor, setDoctor] = useState(model.doctor_name);
  const [meds, setMeds] = useState(() => wrap<ReviewMed>(model.medications));
  const [labs, setLabs] = useState(() => wrap<ReviewLab>(model.labs));
  const [conds, setConds] = useState(() => wrap<ReviewCondition>(model.conditions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const update = <T extends object>(set: React.Dispatch<React.SetStateAction<Item<T>[]>>) => (key: string, patch: Partial<Item<T>>) =>
    set((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const updMed = update<ReviewMed>(setMeds);
  const updLab = update<ReviewLab>(setLabs);
  const updCond = update<ReviewCondition>(setConds);
  const newKey = () => `m${Date.now()}${Math.random().toString(16).slice(2, 6)}`;

  async function retryRead() {
    setRetrying(true);
    await fetch(`/api/documents/${model.documentId}/process`, { method: "POST" }).catch(() => null);
    router.refresh();
    setRetrying(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const keep = <T,>(l: Item<T>[]) => l.filter((x) => !x.removed);
    const payload = {
      doc_date: docDate || null,
      facility: facility || null,
      doctor_name: doctor || null,
      medications: keep(meds).map((m) => ({
        brand_name: m.brand_name.trim(),
        dose: m.dose || null,
        frequency: m.frequency || null,
        duration_days: m.duration_days && m.duration_days > 0 ? Math.round(m.duration_days) : null,
        source_text: m.source_text,
        confidence: m.confidence,
        patient_verified: m.manual || changed(m, ["brand_name", "dose", "frequency", "duration_days"]),
      })),
      lab_results: keep(labs).map((l) => ({
        test_name: l.test_name.trim(),
        value: l.value.trim(),
        unit: l.unit || null,
        ref_range: l.ref_range || null,
        test_date: l.test_date || null,
        source_text: l.source_text,
        confidence: l.confidence,
        patient_verified: l.manual || changed(l, ["test_name", "value", "unit", "test_date"]),
      })),
      conditions: keep(conds).map((c) => ({
        name: c.name.trim(),
        source_text: c.source_text,
        confidence: c.confidence,
        patient_verified: c.manual || changed(c, ["name"]),
      })),
    };
    const blank =
      payload.medications.some((m) => !m.brand_name) || payload.lab_results.some((l) => !l.test_name || !l.value) || payload.conditions.some((c) => !c.name);
    if (blank) {
      setSaving(false);
      return setError("Some added items are empty. Fill them in or remove them.");
    }
    const res = await fetch(`/api/documents/${model.documentId}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (res?.ok || res?.status === 409) {
      router.refresh();
      return;
    }
    const body = await res?.json().catch(() => null);
    setSaving(false);
    setError(body?.error?.message ?? "We could not save. Check your connection and try again.");
  }

  const flaggedMeds = meds.filter((m) => !m.removed && m.reasons.length).length;
  const flaggedLabs = labs.filter((l) => !l.removed && l.reasons.length).length;

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      {model.failed ? (
        <div className="rounded-card border border-rule bg-sheet p-5">
          <p className="font-bold">We could not read this document automatically.</p>
          <p className="mt-1 text-ink-2">
            {model.failReason === "timeout" || model.failReason === "unavailable"
              ? "The reading service was busy. Your file is saved safely."
              : "Your file is saved safely."}{" "}
            Add the details by hand below, or try reading it again.
          </p>
          <button type="button" onClick={retryRead} disabled={retrying} className={cn(buttonClass("secondary", "dense"), "mt-3")}>
            {retrying ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : <ArrowCounterClockwise aria-hidden className="size-5" />}
            Try reading again
          </button>
        </div>
      ) : null}

      <section aria-label="Document details" className="rounded-card border border-rule bg-sheet p-5 sm:p-6">
        <h2 className="text-title font-bold">Document details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.5fr_1fr]">
          <div>
            <label htmlFor="doc-date" className={label}>Date on the document</label>
            <input id="doc-date" type="date" value={docDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDocDate(e.target.value)} className={smallInput} />
          </div>
          <div>
            <label htmlFor="facility" className={label}>Clinic, hospital or lab</label>
            <input id="facility" value={facility} onChange={(e) => setFacility(e.target.value)} className={smallInput} />
          </div>
          <div>
            <label htmlFor="doctor" className={label}>Doctor</label>
            <input id="doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} className={smallInput} />
          </div>
        </div>
        {model.dateMissing && !docDate ? (
          <div className="mt-3 flex gap-2 rounded-control bg-verify-soft px-3 py-2 text-dense text-verify">
            <Question aria-hidden weight="bold" className="mt-0.5 size-5 shrink-0" />
            <p>
              <span className="font-bold">No date found.</span> Add the date written on the paper. If you leave it empty, the upload date ({model.uploadDate}) is used and marked.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-label="Medicines" className="space-y-4 rounded-card border border-rule bg-sheet p-5 sm:p-6">
        <SectionTitle Icon={Prescription} title="Medicines" count={meds.filter((m) => !m.removed).length} flagged={flaggedMeds} />
        <ul className="space-y-4">
          {meds.map((m) =>
            m.removed ? (
              <Removed key={m.key} name={m.brand_name} onUndo={() => updMed(m.key, { removed: false })} />
            ) : (
              <li key={m.key} className={cn("space-y-3 rounded-card border p-4", m.reasons.length ? "border-verify-rule" : "border-rule")}>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`med-${m.key}`} className={label}>Medicine as written</label>
                    <RemoveButton name={m.brand_name} onClick={() => updMed(m.key, { removed: true })} />
                  </div>
                  <input id={`med-${m.key}`} value={m.brand_name} onChange={(e) => updMed(m.key, { brand_name: e.target.value })} className={cn(smallInput, "font-bold")} />
                </div>
                {m.generics.length ? (
                  <p className="text-dense text-ink-2">
                    Medicine inside: <span className="font-semibold capitalize text-ink">{m.generics.join(" + ")}</span>
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_0.8fr_1.4fr]">
                  <div>
                    <label htmlFor={`dose-${m.key}`} className={label}>Dose</label>
                    <input id={`dose-${m.key}`} value={m.dose} onChange={(e) => updMed(m.key, { dose: e.target.value })} className={smallInput} />
                  </div>
                  <div>
                    <label htmlFor={`days-${m.key}`} className={label}>Days</label>
                    <input id={`days-${m.key}`} type="number" inputMode="numeric" min={1} max={3650} value={m.duration_days ?? ""} onChange={(e) => updMed(m.key, { duration_days: e.target.value ? Number(e.target.value) : null })} className={smallInput} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={`freq-${m.key}`} className={label}>How often</label>
                    <input id={`freq-${m.key}`} value={m.frequency} onChange={(e) => updMed(m.key, { frequency: e.target.value })} className={smallInput} aria-describedby={`freq-${m.key}-plain`} />
                    {decodeFrequency(m.frequency) ? (
                      <p id={`freq-${m.key}-plain`} className="mt-1 text-meta font-semibold text-primary">
                        {decodeFrequency(m.frequency)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Flag reasons={m.reasons} />
                <Source text={m.source_text} />
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            const blankMed: ReviewMed = { brand_name: "", dose: "", frequency: "", duration_days: null, source_text: MANUAL_SOURCE, confidence: null, reasons: [], generics: [] };
            setMeds((l) => [...l, { ...blankMed, key: newKey(), removed: false, manual: true, original: blankMed }]);
          }}
          className={buttonClass("secondary", "dense")}
        >
          <Plus aria-hidden className="size-5" /> Add a medicine
        </button>
      </section>

      <section aria-label="Test results" className="space-y-4 rounded-card border border-rule bg-sheet p-5 sm:p-6">
        <SectionTitle Icon={Flask} title="Test results" count={labs.filter((l) => !l.removed).length} flagged={flaggedLabs} />
        <ul className="space-y-3">
          {labs.map((l) =>
            l.removed ? (
              <Removed key={l.key} name={l.test_name} onUndo={() => updLab(l.key, { removed: false })} />
            ) : (
              <li key={l.key} className={cn("space-y-3 rounded-card border p-4", l.reasons.length ? "border-verify-rule" : "border-rule")}>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`lab-${l.key}`} className={label}>Test</label>
                    <RemoveButton name={l.test_name} onClick={() => updLab(l.key, { removed: true })} />
                  </div>
                  <input id={`lab-${l.key}`} value={l.test_name} onChange={(e) => updLab(l.key, { test_name: e.target.value })} className={cn(smallInput, "font-semibold")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`val-${l.key}`} className={label}>Result</label>
                    <input id={`val-${l.key}`} value={l.value} onChange={(e) => updLab(l.key, { value: e.target.value })} className={cn(smallInput, "font-mono")} />
                  </div>
                  <div>
                    <label htmlFor={`unit-${l.key}`} className={label}>Unit</label>
                    <input id={`unit-${l.key}`} value={l.unit} onChange={(e) => updLab(l.key, { unit: e.target.value })} className={smallInput} />
                  </div>
                </div>
                <Flag reasons={l.reasons} />
                <Source text={l.source_text} />
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            const blankLab: ReviewLab = { test_name: "", value: "", unit: "", ref_range: "", test_date: null, source_text: MANUAL_SOURCE, confidence: null, reasons: [] };
            setLabs((l) => [...l, { ...blankLab, key: newKey(), removed: false, manual: true, original: blankLab }]);
          }}
          className={buttonClass("secondary", "dense")}
        >
          <Plus aria-hidden className="size-5" /> Add a test result
        </button>
      </section>

      <section aria-label="Diagnoses" className="space-y-4 rounded-card border border-rule bg-sheet p-5 sm:p-6">
        <SectionTitle Icon={Stethoscope} title="Diagnoses" count={conds.filter((c) => !c.removed).length} flagged={conds.filter((c) => !c.removed && c.reasons.length).length} />
        <ul className="space-y-3">
          {conds.map((c) =>
            c.removed ? (
              <Removed key={c.key} name={c.name} onUndo={() => updCond(c.key, { removed: false })} />
            ) : (
              <li key={c.key} className={cn("space-y-3 rounded-card border p-4", c.reasons.length ? "border-verify-rule" : "border-rule")}>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`dx-${c.key}`} className={label}>Diagnosis</label>
                    <RemoveButton name={c.name} onClick={() => updCond(c.key, { removed: true })} />
                  </div>
                  <input id={`dx-${c.key}`} value={c.name} onChange={(e) => updCond(c.key, { name: e.target.value })} className={cn(smallInput, "font-semibold")} />
                </div>
                <Flag reasons={c.reasons} />
                <Source text={c.source_text} />
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            const blankCond: ReviewCondition = { name: "", source_text: MANUAL_SOURCE, confidence: null, reasons: [] };
            setConds((l) => [...l, { ...blankCond, key: newKey(), removed: false, manual: true, original: blankCond }]);
          }}
          className={buttonClass("secondary", "dense")}
        >
          <Plus aria-hidden className="size-5" /> Add a diagnosis
        </button>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-rule bg-sheet/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={save} disabled={saving} aria-busy={saving} className={buttonClass("primary", "patient", "w-full sm:w-auto")}>
            {saving ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : null}
            {saving ? "Saving..." : "Save to my record"}
          </button>
          {error ? (
            <p role="alert" className="flex items-center gap-2 font-semibold text-severe">
              <WarningOctagon aria-hidden weight="fill" className="size-5" /> {error}
            </p>
          ) : (
            <p className="hidden text-ink-2 sm:block">Only what you save here goes into your record.</p>
          )}
        </div>
      </div>
    </div>
  );
}
