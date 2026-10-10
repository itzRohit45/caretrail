import { dateParts } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Signature element: the daily-sheet date. Day large and tabular, month and year beneath. */
/** compact: small everywhere; responsive: small on phones, full size from sm. */
export function DateBlock({ date, compact, responsive, marker }: { date: string; compact?: boolean; responsive?: boolean; marker?: string }) {
  const { day, month, year } = dateParts(date);
  return (
    <div className={cn("flex shrink-0 flex-col items-center text-center", compact ? "w-12" : responsive ? "w-12 sm:w-16" : "w-16")}>
      <time dateTime={date} className="contents">
        <span className={cn("font-serif font-medium tabular-nums text-ink", compact ? "text-title" : responsive ? "text-title sm:text-display" : "text-display")}>{day}</span>
        <span className="mt-1 text-meta font-semibold text-ink-2">
          {month} {year}
        </span>
      </time>
      {marker ? <span className="mt-1 text-meta font-semibold text-verify">{marker}</span> : null}
    </div>
  );
}
