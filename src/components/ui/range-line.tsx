import { cn } from "@/lib/cn";

/**
 * Signature data mark: where a value sits against its normal range.
 * The track spans a padded window around the range; the normal zone is tinted and labelled.
 */
export function RangeLine({
  value,
  low,
  high,
  unit,
  className,
}: {
  value: number;
  low: number | null;
  high: number | null;
  unit?: string;
  className?: string;
}) {
  const lo = low ?? 0;
  const hi = high ?? lo * 2;
  const span = hi - lo || 1;
  const min = Math.min(lo - span * 0.6, value - span * 0.15);
  const max = Math.max(hi + span * 0.6, value + span * 0.15);
  const pos = (n: number) => `${((n - min) / (max - min)) * 100}%`;
  const out = (low !== null && value < low) || (high !== null && value > high);
  return (
    <div className={cn("pt-1", className)} role="img" aria-label={`${value}${unit ? ` ${unit}` : ""}, ${out ? "outside" : "inside"} the normal range ${lo} to ${hi}`}>
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-pill bg-rule" />
        <div className="absolute top-0 h-3 rounded-pill bg-verified-soft ring-1 ring-verified-rule" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
        <div
          className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-sheet", out ? "bg-severe" : "bg-verified")}
          style={{ left: pos(value) }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-meta text-ink-3 tabular-nums">
        <span className="absolute -translate-x-1/2" style={{ left: pos(lo) }}>{lo}</span>
        <span className="absolute -translate-x-1/2" style={{ left: pos(hi) }}>{hi}</span>
      </div>
    </div>
  );
}
