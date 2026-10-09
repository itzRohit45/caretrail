import { dateParts } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Signature element: the daily-sheet date. Day large and tabular, month and year beneath. */
export function DateBlock({ date, compact, marker }: { date: string; compact?: boolean; marker?: string }) {
  const { day, month, year } = dateParts(date);
  return (
    <div className={cn("flex shrink-0 flex-col items-center text-center", compact ? "w-12" : "w-16")}>
      <time dateTime={date} className="contents">
        <span className={cn("font-serif font-medium tabular-nums text-ink", compact ? "text-title" : "text-display")}>{day}</span>
        <span className="mt-1 text-meta font-semibold text-ink-2">
          {month} {year}
        </span>
      </time>
      {marker ? <span className="mt-1 text-meta font-semibold text-verify">{marker}</span> : null}
    </div>
  );
}
