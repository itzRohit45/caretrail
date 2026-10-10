import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadMedicines } from "@/lib/safety/load";

import { decodeFrequency } from "@/lib/normalise/frequency";
import { daysBetween, formatDate, todayIST } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SafetyAlerts } from "@/components/medicines/safety-alerts";
import { MedicineCard } from "@/components/medicines/medicine-card";

export const metadata: Metadata = { title: "Medicines" };

export default async function MedicinesPage() {
  const { patient } = await requirePatient();
  const { groups, finished, stopped, warnings, unrecognised } = await loadMedicines(await createClient(), patient.id);
  const today = todayIST();

  return (
    <>
      <PageHeader
        title="Your medicines"
        subtitle="Everything your doctors have prescribed, in one list. CareTrail checks them together, across every doctor."
        aside={
          <Link href="/upload" className={buttonClass("primary", "dense")}>
            <Plus aria-hidden weight="bold" className="size-5" /> Add a prescription
          </Link>
        }
      />
      <PageBody>
        {groups.length === 0 && stopped.length === 0 && finished.length === 0 ? (
          <EmptyState
            title="No medicines yet"
            body="Add a prescription or discharge summary. Every medicine on it appears here, and CareTrail checks them against each other and your allergies."
            action={
              <Link href="/upload" className={buttonClass("primary")}>
                <Plus aria-hidden weight="bold" className="size-5" /> Add a prescription
              </Link>
            }
          />
        ) : (
          <>
            {groups.length ? <SafetyAlerts warnings={warnings} unrecognised={unrecognised.map((g) => g.current.brand_name)} /> : null}
            <section aria-labelledby="active-title" className="space-y-4">
              <h2 id="active-title" className="text-title font-bold">
                Taking now <span className="font-normal text-ink-2">({groups.length})</span>
              </h2>
              {groups.length ? (
                <ul className="grid gap-4 md:grid-cols-2">
                  {groups.map((g) => (
                    <MedicineCard
                      key={g.key}
                      group={g}
                      prescribedLongAgo={!g.current.duration_days && g.current.start_date && daysBetween(g.current.start_date, today) > 90 ? g.current.start_date : null}
                    />
                  ))}
                </ul>
              ) : (
                <p className="rounded-card border border-rule bg-sheet p-4 text-ink-2">No medicines are marked as current.</p>
              )}
            </section>
            {finished.length ? (
              <details className="group rounded-card border border-rule bg-sheet p-4 sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  Finished courses ({finished.length})
                  <span className="text-dense font-semibold text-primary group-open:hidden">Show</span>
                </summary>
                <p className="mt-2 text-dense text-ink-2">The number of days written on the prescription has passed, so these are no longer counted as current or checked for clashes.</p>
                <ul className="mt-2 divide-y divide-rule">
                  {finished.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                      <span>
                        <span className="font-semibold">{m.brand_name}</span>
                        <span className="text-ink-2"> {[m.dose, decodeFrequency(m.frequency) ?? m.frequency, m.duration_days ? `${m.duration_days} days` : null].filter(Boolean).join(", ")}</span>
                      </span>
                      <span className="text-dense text-ink-2">
                        {m.prescriber ? `${m.prescriber}, ` : ""}course ended {formatDate(m.ended_on)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {stopped.length ? (
              <details className="group rounded-card border border-rule bg-sheet p-4 sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  Stopped medicines ({stopped.length})
                  <span className="text-dense font-semibold text-primary group-open:hidden">Show</span>
                </summary>
                <ul className="mt-3 divide-y divide-rule">
                  {stopped.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                      <span>
                        <span className="font-semibold">{m.brand_name}</span>
                        <span className="text-ink-2"> {[m.dose, decodeFrequency(m.frequency) ?? m.frequency].filter(Boolean).join(", ")}</span>
                      </span>
                      <span className="text-dense text-ink-2">
                        {m.prescriber ? `${m.prescriber}, ` : ""}stopped {m.stopped_on ? formatDate(m.stopped_on) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}
