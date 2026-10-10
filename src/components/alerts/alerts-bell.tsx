"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bell, X } from "@phosphor-icons/react";
import { AlertRow, type AlertItem } from "./alert-row";
import { dismissAlerts } from "@/lib/alerts-client";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Bell with a count of new alerts; opens a side panel with every alert, new first, then seen. */
export function AlertsBell() {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const bell = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/alerts").catch(() => null);
    if (res?.ok) setAlerts((await res.json()).data.alerts);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const changed = () => void load();
    const show = () => setOpen(true);
    window.addEventListener("ct-alerts-changed", changed);
    window.addEventListener("ct-open-alerts", show);
    return () => {
      clearTimeout(first);
      window.removeEventListener("ct-alerts-changed", changed);
      window.removeEventListener("ct-open-alerts", show);
    };
  }, [load, pathname]);

  // While open: Escape closes, the page behind does not scroll, focus starts on Close and returns to the bell.
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const refresh = setTimeout(load, 0);
    const button = bell.current;
    return () => {
      clearTimeout(refresh);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open, load]);

  const fresh = alerts?.filter((a) => !a.dismissed) ?? [];
  const seen = alerts?.filter((a) => a.dismissed) ?? [];
  const severe = fresh.some((a) => a.level === "severe");
  const dismiss = (ids: string[]) => {
    dismissAlerts(ids);
    setAlerts((list) => list?.map((a) => (ids.includes(a.id) ? { ...a, dismissed: true } : a)) ?? null);
  };

  return (
    <>
      <button
        ref={bell}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={fresh.length ? `Alerts, ${fresh.length} new` : "Alerts"}
        className="relative inline-flex size-11 items-center justify-center rounded-pill text-ink hover:bg-sheet-sunk"
      >
        <Bell aria-hidden weight={fresh.length ? "fill" : "regular"} className="size-6" />
        {fresh.length ? (
          <span aria-hidden className={cn("absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-pill px-1 text-meta font-bold leading-5", severe ? "bg-severe text-on-primary" : "bg-primary text-on-primary")}>
            {fresh.length}
          </span>
        ) : null}
      </button>

      {/* Rendered on <body>: the header's backdrop blur would otherwise trap a fixed panel inside it. */}
      {open ? createPortal(
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label="Close alerts" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <section role="dialog" aria-modal="true" aria-labelledby="alerts-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-float">
            <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <h2 id="alerts-title" className="font-serif text-title font-medium">Alerts</h2>
              <div className="flex items-center gap-1">
                {fresh.length ? (
                  <button type="button" onClick={() => dismiss(fresh.map((a) => a.id))} className={buttonClass("quiet", "dense")}>
                    Dismiss all
                  </button>
                ) : null}
                <button ref={closeBtn} type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-pill hover:bg-sheet-sunk">
                  <X aria-hidden weight="bold" className="size-5" />
                </button>
              </div>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {alerts === null ? (
                <div className="h-24 animate-pulse rounded-card bg-sheet-sunk" />
              ) : alerts.length === 0 ? (
                <p className="text-ink-2">Nothing needs your attention. Emergency scans, doctors&apos; notes, records to check and medicine warnings appear here.</p>
              ) : (
                <>
                  {fresh.length ? (
                    <section aria-label="New" className="space-y-2">
                      <h3 className="text-dense font-semibold text-ink-2">New</h3>
                      {fresh.map((a) => <AlertRow key={a.id} alert={a} onOpen={() => setOpen(false)} onDismiss={() => dismiss([a.id])} />)}
                    </section>
                  ) : null}
                  {seen.length ? (
                    <section aria-label="Seen" className="space-y-2">
                      <h3 className="text-dense font-semibold text-ink-2">Seen</h3>
                      {seen.map((a) => <AlertRow key={a.id} alert={a} compact onOpen={() => setOpen(false)} />)}
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
