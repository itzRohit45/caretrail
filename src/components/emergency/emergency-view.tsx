"use client";

import { useEffect, useState } from "react";
import { Phone, WarningOctagon, FirstAid, ShieldCheck, Pill, Heartbeat, CircleNotch } from "@phosphor-icons/react";
import type { EmergencyCard } from "@/lib/emergency/card";

const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/** Tier 1 emergency page: maximum contrast, critical facts above the fold, tap to call. */
export function EmergencyView() {
  const [state, setState] = useState<{ name: "loading" } | { name: "invalid" } | { name: "limited" } | { name: "ready"; card: EmergencyCard }>({ name: "loading" });

  useEffect(() => {
    const token = window.location.hash.slice(1);
    (async () => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return setState({ name: "invalid" });
      const res = await fetch("/api/e", { headers: { "x-emergency-token": token } }).catch(() => null);
      if (res?.status === 429) return setState({ name: "limited" });
      if (!res?.ok) return setState({ name: "invalid" });
      setState({ name: "ready", card: (await res.json()).data });
    })();
  }, []);

  return (
    <div className="emergency-surface min-h-dvh bg-paper text-ink">
      <header className="flex items-center gap-3 bg-ink px-4 py-3 text-sheet">
        <FirstAid aria-hidden weight="fill" className="size-7 shrink-0" />
        <div>
          <p className="text-lead font-bold">Medical information</p>
          <p className="text-dense">Shared by the patient for emergencies</p>
        </div>
      </header>

      {state.name === "loading" ? (
        <p role="status" className="flex items-center justify-center gap-3 p-10 text-lead font-semibold">
          <CircleNotch aria-hidden weight="bold" className="size-7 animate-spin" /> Opening
        </p>
      ) : state.name === "invalid" ? (
        <main className="mx-auto max-w-md px-5 py-12 text-center">
          <h1 className="text-display font-bold">This emergency card is not valid</h1>
          <p className="mt-3 text-lead text-ink-2">It may have been replaced by a newer card. Check the patient&apos;s phone or wallet for a new QR code.</p>
        </main>
      ) : state.name === "limited" ? (
        <main className="mx-auto max-w-md px-5 py-12 text-center">
          <h1 className="text-display font-bold">Please try again in a minute</h1>
        </main>
      ) : (
        <Card card={state.card} />
      )}
    </div>
  );
}

function Card({ card }: { card: EmergencyCard }) {
  return (
    <main className="mx-auto max-w-2xl">
      <section className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h1 className="text-emergency font-extrabold break-words">{card.name}</h1>
          <p className="mt-1 text-title font-semibold text-ink-2">{[card.age !== null ? `${card.age} years` : null, cap(card.sex)].filter(Boolean).join(", ") || "Age not recorded"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-card border-4 border-ink px-4 py-2">
          <span className="text-dense font-bold">Blood group</span>
          <span className="text-emergency font-extrabold leading-none">{card.blood_group ?? "?"}</span>
        </div>
      </section>

      {card.allergies.length ? (
        <section aria-label="Allergies" className="bg-severe px-5 py-4 text-on-primary">
          <p className="flex items-center gap-2 text-lead font-bold"><WarningOctagon aria-hidden weight="fill" className="size-7" /> Allergic to</p>
          <ul className="mt-1 space-y-0.5">
            {card.allergies.map((a) => (
              <li key={a.substance} className="text-title font-extrabold">
                {a.substance} <span className="font-semibold">({a.severity}{a.reaction ? `, ${a.reaction}` : ""})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="Allergies" className="flex items-center gap-3 border-y-2 border-ink px-5 py-4">
          <ShieldCheck aria-hidden className="size-7 shrink-0" />
          <p className="text-title font-bold">No known allergies recorded</p>
        </section>
      )}

      <div className="px-5 py-5">
        {card.contact.phone ? (
          <a href={telHref(card.contact.phone)} className="flex min-h-16 items-center gap-4 rounded-card bg-ink px-5 py-3 text-sheet active:scale-[0.98]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-sheet text-ink">
              <Phone aria-hidden weight="fill" className="size-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-lead font-bold">Call {card.contact.name ?? "emergency contact"}</span>
              <span className="block font-mono text-lead font-semibold tabular-nums">{card.contact.phone}</span>
            </span>
          </a>
        ) : (
          <p className="rounded-card border-2 border-ink px-5 py-4 text-lead font-bold">No emergency contact recorded</p>
        )}
      </div>

      <section aria-labelledby="cond-title" className="border-t-2 border-ink px-5 py-5">
        <h2 id="cond-title" className="flex items-center gap-2 text-title font-bold"><Heartbeat aria-hidden className="size-6" /> Conditions</h2>
        {card.conditions.length ? (
          <ul className="mt-2 space-y-1 text-lead font-semibold">{card.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
        ) : (
          <p className="mt-2 text-lead">None recorded</p>
        )}
      </section>

      <section aria-labelledby="meds-title" className="border-t-2 border-ink px-5 py-5">
        <h2 id="meds-title" className="flex items-center gap-2 text-title font-bold"><Pill aria-hidden className="size-6" /> Current medicines</h2>
        {card.medicines.length ? (
          <ul className="mt-2 divide-y divide-rule">
            {card.medicines.map((m) => (
              <li key={m.name} className="py-2">
                <p className="text-lead font-bold">{m.name}{m.generic ? <span className="font-semibold text-ink-2"> ({m.generic})</span> : null}</p>
                <p className="text-body text-ink-2">{[m.dose, m.frequency].filter(Boolean).join(", ")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-lead">None recorded</p>
        )}
      </section>

      <footer className="px-5 pt-2 pb-10 text-dense text-ink-2">
        This is the patient&apos;s own record, shared through CareTrail. It shows critical information only. Each scan is recorded and the patient is told.
      </footer>
    </main>
  );
}
