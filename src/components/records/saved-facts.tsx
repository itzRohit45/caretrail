import { Prescription, Flask, Stethoscope } from "@phosphor-icons/react/ssr";
import { decodeFrequency } from "@/lib/normalise/frequency";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { RangeLine } from "@/components/ui/range-line";
import type { Row } from "@/lib/db/types";

type Range = { test_code: string; low: number | null; high: number | null };

function Group({ Icon, title, children }: { Icon: typeof Flask; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-rule bg-sheet p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-title font-bold">
        <span className="flex size-10 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <Icon aria-hidden weight="duotone" className="size-5" />
        </span>
        {title}
      </h2>
      <ul className="mt-4 divide-y divide-rule">{children}</ul>
    </section>
  );
}

export function SavedFacts({
  medications,
  labs,
  conditions,
  ranges,
}: {
  medications: Row<"medications">[];
  labs: Row<"lab_results">[];
  conditions: Row<"conditions">[];
  ranges: Range[];
}) {
  const rangeFor = (code: string | null) => ranges.find((r) => r.test_code === code);
  if (!medications.length && !labs.length && !conditions.length) {
    return <p className="rounded-card border border-rule bg-sheet p-5 text-ink-2">Nothing from this document was added to your record. The original is kept for your doctor to see.</p>;
  }
  return (
    <div className="space-y-6">
      {medications.length ? (
        <Group Icon={Prescription} title="Medicines">
          {medications.map((m) => (
            <li key={m.id} className="py-3.5">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {m.brand_name}
                {m.verified_by_patient ? <Badge tone="patient-verified" /> : null}
                {!m.recognised ? <Badge tone="unrecognised" /> : null}
              </p>
              <p className="text-ink-2">
                {[m.generic_name ? m.generic_name.replace(/\b\w/g, (c) => c.toUpperCase()) : null, m.dose, decodeFrequency(m.frequency) ?? m.frequency, m.duration_days ? `for ${m.duration_days} days` : null]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </li>
          ))}
        </Group>
      ) : null}
      {labs.length ? (
        <Group Icon={Flask} title="Test results">
          {labs.filter((l) => l.test_code !== "BP_DIA").map((l) => {
            const r = l.test_code === "BP_SYS" ? undefined : rangeFor(l.test_code);
            const v = l.value_normalised ?? l.value;
            return (
              <li key={l.id} className="grid gap-2 py-3.5 sm:grid-cols-[1fr_12rem] sm:items-center sm:gap-6">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {l.test_name}
                    {l.verified_by_patient ? <Badge tone="patient-verified" /> : null}
                  </p>
                  <p className="text-ink-2">
                    <span className="font-serif text-lead font-medium text-ink tabular-nums">{l.test_code === "BP_SYS" ? l.value_text : (l.value ?? l.value_text)}</span> {l.unit}
                    <span className="text-meta"> on {formatDate(l.test_date)}</span>
                  </p>
                </div>
                {r && v !== null && l.value_normalised !== null ? <RangeLine value={v} low={r.low} high={r.high} unit={l.unit_normalised ?? undefined} /> : null}
              </li>
            );
          })}
        </Group>
      ) : null}
      {conditions.length ? (
        <Group Icon={Stethoscope} title="Diagnoses">
          {conditions.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-3.5 font-bold">
              {c.name}
              {c.verified_by_patient ? <Badge tone="patient-verified" /> : null}
            </li>
          ))}
        </Group>
      ) : null}
    </div>
  );
}
