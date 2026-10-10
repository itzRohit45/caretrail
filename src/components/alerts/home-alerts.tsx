"use client";

import { useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { AlertRow, type AlertItem } from "./alert-row";
import { dismissAlerts, openAlerts } from "@/lib/alerts-client";
import { buttonClass } from "@/components/ui/button";

const SHOWN = 2;

/** Home shows at most two alerts, each dismissible; the rest are one tap away in the alert panel. */
export function HomeAlerts({ alerts }: { alerts: AlertItem[] }) {
  const [list, setList] = useState(alerts);
  if (!list.length) return null;
  const more = list.length - SHOWN;
  return (
    <section aria-label="Alerts" className="space-y-2">
      {list.slice(0, SHOWN).map((a) => (
        <AlertRow
          key={a.id}
          alert={a}
          onDismiss={() => {
            dismissAlerts([a.id]);
            setList((l) => l.filter((x) => x.id !== a.id));
          }}
        />
      ))}
      {more > 0 ? (
        <button type="button" onClick={openAlerts} className={buttonClass("quiet", "dense")}>
          <Bell aria-hidden className="size-5" /> View all alerts ({list.length})
        </button>
      ) : null}
    </section>
  );
}
