import Link from "next/link";
import { X, FunnelSimple, CaretDown } from "@phosphor-icons/react/ssr";
import { CONDITION_FILTERS, RANGE_FILTERS, type TimelineFilters } from "@/lib/records/timeline";
import { CONDITION_LABELS } from "@/lib/normalise/conditions";
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/schemas/documents";
import { cn } from "@/lib/cn";

function href(current: TimelineFilters, patch: Partial<TimelineFilters>) {
  const next = { ...current, ...patch };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) q.set(k, String(v));
  const s = q.toString();
  return s ? `/records?${s}` : "/records";
}

function Chip({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-dense font-semibold whitespace-nowrap transition-colors duration-150",
        on ? "border-primary bg-primary text-on-primary" : "border-rule-strong bg-sheet text-ink hover:border-ink",
      )}
    >
      {children}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
      <p className="w-24 shrink-0 text-dense font-semibold text-ink-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Phones: one "Filter" bar that names what is on and opens the choices on tap, so the timeline starts
 * right under it. From md the choices are always shown.
 */
export function TimelineFilterBar({ filters }: { filters: TimelineFilters }) {
  const on = [
    filters.condition ? CONDITION_LABELS[filters.condition as keyof typeof CONDITION_LABELS] : null,
    filters.type ? DOC_TYPE_LABELS[filters.type as keyof typeof DOC_TYPE_LABELS] : null,
    filters.months ? `Last ${filters.months} months` : filters.from || filters.to ? "Chosen dates" : null,
  ].filter(Boolean) as string[];
  return (
    <section aria-label="Filter records">
      {/* Keyed by the filters, so it closes after each choice and the results show right under it. */}
      <details key={on.join("|") || "all"} className="group rounded-card border border-rule bg-sheet md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
          <FunnelSimple aria-hidden weight="bold" className="size-5 shrink-0 text-primary" />
          <span className="font-semibold">Filter</span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {on.length ? (
              on.map((label) => <span key={label} className="rounded-pill bg-primary-soft px-2.5 py-0.5 text-meta font-semibold text-primary">{label}</span>)
            ) : (
              <span className="text-dense text-ink-2">All records</span>
            )}
          </span>
          <CaretDown aria-hidden weight="bold" className="size-5 shrink-0 text-ink-2 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-rule px-4 pt-3 pb-4">
          <Choices filters={filters} active={on.length > 0} />
        </div>
      </details>
      <div className="hidden space-y-3 rounded-card border border-rule bg-sheet p-5 md:block">
        <Choices filters={filters} active={on.length > 0} />
      </div>
    </section>
  );
}

function Choices({ filters, active }: { filters: TimelineFilters; active: boolean }) {
  return (
    <>
      <Row label="Condition">
        <Chip to={href(filters, { condition: undefined })} on={!filters.condition}>All</Chip>
        {CONDITION_FILTERS.map((c) => (
          <Chip key={c} to={href(filters, { condition: c })} on={filters.condition === c}>{CONDITION_LABELS[c]}</Chip>
        ))}
      </Row>
      <Row label="Type">
        <Chip to={href(filters, { type: undefined })} on={!filters.type}>All</Chip>
        {DOC_TYPES.map((t) => (
          <Chip key={t} to={href(filters, { type: t })} on={filters.type === t}>{DOC_TYPE_LABELS[t]}</Chip>
        ))}
      </Row>
      <Row label="When">
        <Chip to={href(filters, { months: undefined, from: undefined, to: undefined })} on={!filters.months && !filters.from}>All time</Chip>
        {RANGE_FILTERS.map((m) => (
          <Chip key={m} to={href(filters, { months: m, from: undefined, to: undefined })} on={filters.months === m}>Last {m} months</Chip>
        ))}
      </Row>
      {active ? (
        <Link href="/records" scroll={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 font-semibold text-primary hover:underline">
          <X aria-hidden weight="bold" className="size-4" /> Clear filters
        </Link>
      ) : null}
    </>
  );
}
