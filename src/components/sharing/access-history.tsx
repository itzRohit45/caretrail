"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, FileText, Key, Prohibit, Siren, NotePencil, WarningOctagon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type Log = { id: number; share_link_id: string | null; viewer_name: string | null; viewer_reg_no: string | null; viewer_hospital: string | null; action: string; created_at: string };
type Data = { logs: Log[]; viewing_now: { id: string; share_link_id: string; viewer_name: string }[]; links: { id: string; label: string | null; is_break_glass: boolean }[] };

const ACTIONS: Record<string, { Icon: typeof Eye; text: (who: string) => string; flag?: "severe" | "caution" }> = {
  opened: { Icon: Eye, text: (who) => `${who} opened your records` },
  viewed_document: { Icon: FileText, text: (who) => `${who} viewed a document` },
  added_note: { Icon: NotePencil, text: (who) => `${who} added a note` },
  otp_failed: { Icon: Key, text: (who) => `${who} entered a wrong code`, flag: "caution" },
  denied_out_of_scope: { Icon: Prohibit, text: (who) => `${who} tried to open something you did not share. It was blocked.`, flag: "caution" },
  emergency_scan: { Icon: Siren, text: () => "Your emergency card was scanned", flag: "caution" },
  break_glass: { Icon: WarningOctagon, text: (who) => `${who} used emergency full access`, flag: "severe" },
};

const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function AccessHistory() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch("/api/access-logs").catch(() => null);
    if (!res?.ok) return setError(true);
    setError(false);
    setData((await res.json()).data);
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!data) return error ? <p role="alert" className="font-semibold text-severe">Access history could not load. Retrying...</p> : <div className="h-40 animate-pulse rounded-card bg-sheet-sunk" />;
  const label = (id: string | null) => data.links.find((l) => l.id === id)?.label;
  const days = new Map<string, Log[]>();
  for (const l of data.logs) days.set(day(l.created_at), [...(days.get(day(l.created_at)) ?? []), l]);

  return (
    <div className="space-y-6">
      {data.viewing_now.length ? (
        <p role="status" className="flex items-center gap-3 rounded-card border border-verified-rule bg-verified-soft p-4 font-semibold text-verified">
          <span aria-hidden className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-pill bg-verified opacity-60" />
            <span className="relative inline-flex size-3 rounded-pill bg-verified" />
          </span>
          {data.viewing_now.map((v) => v.viewer_name).join(", ")} {data.viewing_now.length === 1 ? "is" : "are"} viewing your records now
        </p>
      ) : null}
      {data.logs.length === 0 ? (
        <p className="rounded-card border border-rule bg-sheet p-5 text-ink-2">Nobody has opened your records yet. Every view will appear here, with the name the doctor entered and the time.</p>
      ) : (
        [...days.entries()].map(([d, logs]) => (
          <section key={d} aria-label={d}>
            <h2 className="mb-3 font-serif text-title font-medium">{d}</h2>
            <ol className="divide-y divide-rule rounded-card border border-rule bg-sheet">
              {logs.map((l) => {
                const a = ACTIONS[l.action] ?? { Icon: Eye, text: (w: string) => `${w}: ${l.action}` };
                const who = l.viewer_name ?? "Someone";
                return (
                  <li key={l.id} className={cn("flex items-start gap-3 px-4 py-3.5", a.flag === "severe" && "bg-severe-soft")}>
                    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-pill", a.flag === "severe" ? "bg-severe text-on-primary" : a.flag === "caution" ? "bg-sheet-sunk text-ink" : "bg-primary-soft text-primary")}>
                      <a.Icon aria-hidden weight={a.flag ? "fill" : "regular"} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-semibold", a.flag === "severe" && "text-severe")}>{a.text(who)}</p>
                      <p className="text-dense text-ink-2">
                        {time(l.created_at)}
                        {label(l.share_link_id) ? `, link "${label(l.share_link_id)}"` : ""}
                        {l.viewer_hospital ? `, ${l.viewer_hospital}` : ""}
                        {l.viewer_reg_no ? `, reg. no. ${l.viewer_reg_no}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
      <p className="text-meta text-ink-3">This history cannot be edited or deleted, by you or by CareTrail.</p>
    </div>
  );
}
