"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, PencilSimple, Prohibit, CircleNotch, CalendarX } from "@phosphor-icons/react";
import type { MedGroup } from "@/lib/safety/engine";
import { decodeFrequency } from "@/lib/normalise/frequency";
import { formatDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function MedicineCard({ group, endedOn }: { group: MedGroup; endedOn: string | null }) {
  const router = useRouter();
  const m = group.current;
  const [mode, setMode] = useState<"view" | "confirm-stop" | "edit">("view");
  const [dose, setDose] = useState(m.dose ?? "");
  const [frequency, setFrequency] = useState(m.frequency ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/medications/${m.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("That did not save. Check your connection and try again.");
    setMode("view");
    router.refresh();
  }

  return (
    <li className="rounded-card border border-rule bg-sheet p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lead font-bold">{m.brand_name}</p>
          <p className="text-ink-2">{m.generic_name ? titleCase(m.generic_name) : <span className="font-semibold">Unrecognised name, kept as written</span>}</p>
        </div>
        {m.verified_by_patient ? <span className="rounded-pill bg-verified-soft px-2.5 py-0.5 text-meta font-semibold text-verified">Corrected by you</span> : null}
      </div>

      {mode === "edit" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`dose-${m.id}`} className="mb-1 block text-dense font-semibold text-ink-2">Dose</label>
            <input id={`dose-${m.id}`} value={dose} onChange={(e) => setDose(e.target.value)} className={cn(inputClass, "min-h-12")} />
          </div>
          <div>
            <label htmlFor={`freq-${m.id}`} className="mb-1 block text-dense font-semibold text-ink-2">How often</label>
            <input id={`freq-${m.id}`} value={frequency} onChange={(e) => setFrequency(e.target.value)} className={cn(inputClass, "min-h-12")} />
            {decodeFrequency(frequency) ? <p className="mt-1 text-meta font-semibold text-primary">{decodeFrequency(frequency)}</p> : null}
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-dense sm:grid-cols-2">
          <div><dt className="inline text-ink-2">Dose: </dt><dd className="inline font-semibold">{m.dose ?? "Not written"}</dd></div>
          <div><dt className="inline text-ink-2">How often: </dt><dd className="inline font-semibold">{decodeFrequency(m.frequency) ?? m.frequency ?? "Not written"}</dd></div>
          <div><dt className="inline text-ink-2">Prescribed by: </dt><dd className="inline font-semibold">{m.prescriber ?? "Unknown"}</dd></div>
          <div><dt className="inline text-ink-2">Since: </dt><dd className="inline font-semibold">{m.start_date ? formatDate(m.start_date) : "Unknown"}</dd></div>
        </dl>
      )}

      {group.history.length ? (
        <p className="mt-2 text-meta text-ink-2">
          Also prescribed {group.history.map((h) => `${h.start_date ? formatDate(h.start_date) : "earlier"}${h.prescriber ? ` by ${h.prescriber}` : ""}`).join("; ")}
        </p>
      ) : null}

      {endedOn && mode === "view" ? (
        <p className="mt-3 flex items-start gap-2 rounded-control bg-sheet-sunk px-3 py-2 text-dense">
          <CalendarX aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
          <span>
            This course was written to end on <span className="font-semibold">{formatDate(endedOn)}</span>. If you have finished it, mark it as stopped.
          </span>
        </p>
      ) : null}

      {mode === "confirm-stop" ? (
        <div className="mt-4 rounded-control border border-rule-strong p-3">
          <p className="font-semibold">Mark {m.brand_name} as stopped?</p>
          <p className="text-dense text-ink-2">Only if your doctor stopped it or you finished the course. It stays in your history.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => send({ action: "stop" })} className={buttonClass("primary", "dense")}>
              {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : null} Yes, mark stopped
            </button>
            <button type="button" onClick={() => setMode("view")} className={buttonClass("quiet", "dense")}>Keep it</button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 font-semibold text-severe">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <Link href={`/records/${m.source_document_id}`} className={buttonClass("quiet", "dense")}>
          <FileText aria-hidden className="size-5" /> Source
        </Link>
        {mode === "edit" ? (
          <>
            <button type="button" disabled={busy} onClick={() => send({ action: "edit", dose: dose || null, frequency: frequency || null })} className={buttonClass("primary", "dense")}>
              {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : null} Save
            </button>
            <button type="button" onClick={() => setMode("view")} className={buttonClass("quiet", "dense")}>Cancel</button>
          </>
        ) : mode === "view" ? (
          <>
            <button type="button" onClick={() => setMode("edit")} className={buttonClass("quiet", "dense")}>
              <PencilSimple aria-hidden className="size-5" /> Correct dose
            </button>
            <button type="button" onClick={() => setMode("confirm-stop")} className={buttonClass("quiet", "dense")}>
              <Prohibit aria-hidden className="size-5" /> Mark as stopped
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
