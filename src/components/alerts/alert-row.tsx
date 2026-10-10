import Link from "next/link";
import { Siren, WarningOctagon, Warning, NotePencil, FileMagnifyingGlass, Pill, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export type AlertItem = { id: string; kind: "break_glass" | "scan" | "check" | "note" | "meds"; level: "severe" | "caution" | "info"; title: string; detail: string; href: string; at: string; dismissed?: boolean };

const ICON = { break_glass: WarningOctagon, scan: Siren, check: FileMagnifyingGlass, note: NotePencil, meds: Pill };

/** One alert: icon + words (never colour alone), a link to act on it, and an optional dismiss. */
export function AlertRow({ alert, onDismiss, onOpen, compact }: { alert: AlertItem; onDismiss?: () => void; onOpen?: () => void; compact?: boolean }) {
  const Icon = alert.level === "severe" && alert.kind === "meds" ? WarningOctagon : alert.kind === "meds" ? Warning : ICON[alert.kind];
  return (
    <div className={cn("flex items-start gap-2 rounded-card border", compact ? "p-3" : "p-3.5", alert.level === "severe" ? "border-severe-rule bg-severe-soft" : alert.level === "caution" ? "border-rule-strong bg-sheet" : "border-rule bg-sheet")}>
      <Link href={alert.href} onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-control">
        <Icon aria-hidden weight="fill" className={cn("mt-0.5 size-6 shrink-0", alert.level === "severe" ? "text-severe" : "text-ink")} />
        <span className="min-w-0">
          <span className={cn("block font-bold", alert.level === "severe" && "text-severe")}>
            <span className="sr-only">{alert.level === "severe" ? "Serious: " : ""}</span>
            {alert.title}
          </span>
          <span className="block text-dense text-ink-2">{alert.detail}</span>
        </span>
      </Link>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label={`Dismiss: ${alert.title}`} className="-m-1 inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-2 hover:bg-sheet-sunk hover:text-ink">
          <X aria-hidden weight="bold" className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
