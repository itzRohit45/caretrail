import Link from "next/link";
import { X } from "@phosphor-icons/react/ssr";
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
      {/* Phones: one scrolling row per filter instead of a wall of wrapped chips. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">{children}</div>
    </div>
  );
}

export function TimelineFilterBar({ filters }: { filters: TimelineFilters }) {
  const active = Boolean(filters.condition || filters.type || filters.months || filters.from || filters.to);
  return (
    <section aria-label="Filter records" className="space-y-3 overflow-hidden rounded-card border border-rule bg-sheet p-4 sm:p-5">
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
    </section>
  );
}
