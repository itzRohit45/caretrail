import { FileText, Prescription, WarningOctagon, TrendUp, ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import { RangeLine } from "@/components/ui/range-line";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// Showcase pieces built from real CareTrail components. All names and values are simulated.

export function SampleLabCard({ className }: { className?: string }) {
  return (
    <article className={cn("rounded-card border border-rule bg-sheet p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">HbA1c</p>
        <p className="text-meta text-ink-2">19 Sep 2026</p>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-serif text-display font-medium tabular-nums">7.4 %</p>
        <p className="flex items-center gap-1 text-meta font-semibold text-severe">
          <TrendUp aria-hidden weight="bold" className="size-4" />
          from 6.8
        </p>
      </div>
      <RangeLine value={7.4} low={4} high={5.6} unit="%" className="mt-2" />
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-meta font-semibold text-primary">
          <FileText aria-hidden className="size-4 shrink-0" />
          <span className="truncate">Sri Ram Diagnostics</span>
        </p>
        <Badge tone="verified" />
      </div>
    </article>
  );
}

export function SampleWarningCard({ className }: { className?: string }) {
  return (
    <article className={cn("rounded-card border border-severe-rule bg-sheet p-4", className)}>
      <p className="flex items-center gap-2 font-bold text-severe">
        <WarningOctagon aria-hidden weight="fill" className="size-5 shrink-0" />
        Metformin prescribed twice
      </p>
      <ul className="mt-2 space-y-1.5 text-dense text-ink-2">
        <li className="flex items-center gap-2">
          <Prescription aria-hidden className="size-4 shrink-0" /> Glycomet 500, Dr. A. Suresh
        </li>
        <li className="flex items-center gap-2">
          <Prescription aria-hidden className="size-4 shrink-0" /> Gluconorm 500, Dr. K. Ramesh
        </li>
      </ul>
    </article>
  );
}

export function SampleViewingPill({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 rounded-pill bg-sheet px-4 py-2 text-dense font-semibold", className)}>
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-pill bg-verified opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-pill bg-verified" />
      </span>
      Dr. Meena Raghavan is viewing
    </p>
  );
}

const briefRows: { label: string; fact: string; source: string; badge?: "patient-verified" | "recent" }[] = [
  { label: "Condition", fact: "Type 2 diabetes mellitus", source: "Discharge summary, 12 Mar 2026" },
  { label: "Medicine", fact: "Metformin 500 mg, morning and night", source: "Prescription, Dr. A. Suresh" },
  { label: "Allergy", fact: "Penicillin, severe", source: "Entered by patient", badge: "patient-verified" },
  { label: "Recent test", fact: "HbA1c 7.4 %, 21 days ago", source: "Lab report, Sri Ram Diagnostics", badge: "recent" },
];

export function SampleBrief() {
  return (
    <article className="overflow-hidden rounded-card border border-rule bg-sheet">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule bg-sheet-sunk px-5 py-4">
        <p className="font-bold">Ravi Kumar, 55, male</p>
        <p className="flex items-center gap-1.5 text-meta font-semibold text-ink-2">
          <ClockCounterClockwise aria-hidden className="size-4" />
          Diabetes only, ends in 23 h
        </p>
      </header>
      <ul className="divide-y divide-rule">
        {briefRows.map((r) => (
          <li key={r.label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[7rem_1fr]">
            <p className="text-meta font-semibold text-ink-3">{r.label}</p>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {r.fact}
                {r.badge ? <Badge tone={r.badge} /> : null}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-meta font-semibold text-primary underline decoration-primary-soft decoration-2">
                <FileText aria-hidden className="size-4 shrink-0" />
                {r.source}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
