"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ShareNetwork, CheckCircle, CircleNotch, LinkSimple, Eye, Prohibit, Key, Clock, WarningOctagon, NotePencil } from "@phosphor-icons/react";
import { CONDITION_FILTERS } from "@/lib/records/timeline";
import { CONDITION_LABELS } from "@/lib/normalise/conditions";
import { describeScope } from "@/lib/sharing/scope";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Link = {
  id: string;
  label: string | null;
  scope_type: "all" | "conditions" | "months";
  scope_conditions: string[];
  scope_months: number | null;
  expires_at: string;
  status: "active" | "expired" | "revoked";
  views: number;
  viewing_now: string[];
  otp_code: string | null;
  is_break_glass: boolean;
  allow_write_back: boolean;
};
type Created = { url: string; otp_code: string | null; expires_at: string; label: string; scope: string };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
function remaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : h ? `${h} h ${m} min` : `${m} min`;
}

function Tile({ checked, onChange, children, type = "radio", name }: { checked: boolean; onChange: () => void; children: React.ReactNode; type?: "radio" | "checkbox"; name: string }) {
  return (
    <label className={cn("flex min-h-13 cursor-pointer items-center justify-center rounded-control border px-2 text-center font-semibold transition-colors duration-150 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary", checked ? "border-primary bg-primary text-on-primary" : "border-rule-strong bg-sheet text-ink hover:border-ink")}>
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function LiveBadge({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-pill bg-verified-soft px-3 py-1 text-dense font-semibold text-verified" role="status">
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-pill bg-verified opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-pill bg-verified" />
      </span>
      {names.join(", ")} {names.length === 1 ? "is" : "are"} viewing now
    </p>
  );
}

export function ShareManager() {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"all" | "conditions" | "months">("conditions");
  const [conditions, setConditions] = useState<string[]>([]);
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [expiry, setExpiry] = useState<"1h" | "24h" | "7d">("24h");
  const [otp, setOtp] = useState(false);
  const [writeBack, setWriteBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shares").catch(() => null);
    if (!res?.ok) return setLoadError(true);
    setLoadError(false);
    setLinks((await res.json()).data);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    const body = { label, scope_type: scope, scope_conditions: scope === "conditions" ? conditions : [], scope_months: scope === "months" ? months : null, expires_in: expiry, require_otp: otp, allow_write_back: writeBack };
    const res = await fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(json?.error?.fields?.[0]?.message ?? json?.error?.message ?? "The link could not be created. Check your connection.");
    setCreated({ ...json.data, label: label || "Shared records", scope: describeScope({ type: scope, conditions, months: scope === "months" ? months : null }) });
    setCopied(false);
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/shares/${id}/revoke`, { method: "POST" }).catch(() => null);
    setConfirmRevoke(null);
    load();
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url).catch(() => null);
    setCopied(true);
  }

  const active = (links ?? []).filter((l) => l.status === "active");
  const past = (links ?? []).filter((l) => l.status !== "active");

  return (
    <div className="space-y-8">
      {created ? (
        <section aria-labelledby="created-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-7">
          <h2 id="created-title" className="flex items-center gap-2 text-title font-bold">
            <CheckCircle aria-hidden weight="fill" className="size-6 text-verified" /> Link ready
          </h2>
          <p className="mt-1 text-ink-2">
            {created.label}. {created.scope}. Ends {fmt(created.expires_at)}.
          </p>
          <div className="mt-5 grid items-start gap-6 md:grid-cols-[auto_1fr]">
            <div role="img" aria-label="QR code for the doctor to scan" className="justify-self-center rounded-card border border-rule bg-sheet p-4">
              <QRCodeSVG value={created.url} size={208} level="M" marginSize={0} aria-hidden />
            </div>
            <div className="space-y-4">
              <p className="text-ink">The doctor scans this code with their phone camera, or opens the link. No app or account needed.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(created.url)} className={buttonClass("secondary", "dense")}>
                  {copied ? <CheckCircle aria-hidden weight="fill" className="size-5 text-verified" /> : <Copy aria-hidden className="size-5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <button type="button" onClick={() => navigator.share({ title: "Medical records", text: "Records shared with you through CareTrail", url: created.url }).catch(() => null)} className={buttonClass("secondary", "dense")}>
                    <ShareNetwork aria-hidden className="size-5" /> Send
                  </button>
                ) : null}
              </div>
              {created.otp_code ? (
                <div className="rounded-control bg-primary-soft p-4">
                  <p className="font-semibold">Read this code to the doctor</p>
                  <p className="mt-1 font-mono text-display font-bold tracking-widest text-primary">{created.otp_code.replace(/(\d{3})(\d{3})/, "$1 $2")}</p>
                </div>
              ) : null}
              <p className="flex items-start gap-2 rounded-control bg-verify-soft px-3 py-2 text-dense text-verify">
                <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
                For your safety this link and QR are shown only once. Keep this screen open at the clinic, or copy the link now.
              </p>
              <button type="button" onClick={() => setCreated(null)} className={buttonClass("quiet", "dense")}>Done</button>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="new-title" className="space-y-6 rounded-card border border-rule bg-sheet p-5 sm:p-7">
          <h2 id="new-title" className="text-title font-bold">Share with a doctor</h2>
          <div>
            <label htmlFor="share-label" className="mb-1 block font-semibold">Who is it for? <span className="font-normal text-ink-3">(optional)</span></label>
            <p id="share-label-help" className="mb-2 text-dense text-ink-2">A note for you, for example &quot;Dr. Meena, diabetes clinic&quot;.</p>
            <input id="share-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} aria-describedby="share-label-help" className={inputClass} />
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-1 font-semibold">What can they see?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <Tile name="scope" checked={scope === "conditions"} onChange={() => setScope("conditions")}>Some conditions</Tile>
              <Tile name="scope" checked={scope === "months"} onChange={() => setScope("months")}>Recent records</Tile>
              <Tile name="scope" checked={scope === "all"} onChange={() => setScope("all")}>Everything</Tile>
            </div>
            {scope === "conditions" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {CONDITION_FILTERS.map((c) => (
                  <Tile key={c} type="checkbox" name="conditions" checked={conditions.includes(c)} onChange={() => setConditions((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))}>
                    {CONDITION_LABELS[c]}
                  </Tile>
                ))}
              </div>
            ) : null}
            {scope === "months" ? (
              <div className="grid grid-cols-3 gap-2">
                {([3, 6, 12] as const).map((m) => (
                  <Tile key={m} name="months" checked={months === m} onChange={() => setMonths(m)}>Last {m} months</Tile>
                ))}
              </div>
            ) : null}
            <p className="text-dense text-ink-2">Your allergies and blood group are always included, for your safety.</p>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">For how long?</legend>
            <div className="grid grid-cols-3 gap-2">
              <Tile name="expiry" checked={expiry === "1h"} onChange={() => setExpiry("1h")}><span className="whitespace-nowrap">1 hour</span></Tile>
              <Tile name="expiry" checked={expiry === "24h"} onChange={() => setExpiry("24h")}><span className="whitespace-nowrap">24 hours</span></Tile>
              <Tile name="expiry" checked={expiry === "7d"} onChange={() => setExpiry("7d")}><span className="whitespace-nowrap">7 days</span></Tile>
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 rounded-control border border-rule p-4">
            <input type="checkbox" checked={otp} onChange={(e) => setOtp(e.target.checked)} className="mt-1 size-5 accent-primary" />
            <span>
              <span className="block font-semibold">Ask the doctor for a code</span>
              <span className="block text-dense text-ink-2">You read a 6-digit code to the doctor. Useful if the link could be forwarded.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-control border border-rule p-4">
            <input type="checkbox" checked={writeBack} onChange={(e) => setWriteBack(e.target.checked)} className="mt-1 size-5 accent-primary" />
            <span>
              <span className="block font-semibold">Let the doctor add to my record</span>
              <span className="block text-dense text-ink-2">They can leave a note or upload a new prescription. You check every prescription before it joins your record.</span>
            </span>
          </label>
          {error ? <p role="alert" className="font-semibold text-severe">{error}</p> : null}
          <button type="button" onClick={create} disabled={busy || (scope === "conditions" && conditions.length === 0)} className={buttonClass("primary")}>
            {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : <LinkSimple aria-hidden weight="bold" className="size-5" />}
            Create link
          </button>
          {scope === "conditions" && conditions.length === 0 ? <p className="text-dense text-ink-2">Choose at least one condition.</p> : null}
        </section>
      )}

      <section aria-labelledby="active-title" className="space-y-3">
        <h2 id="active-title" className="text-title font-bold">Active links</h2>
        {loadError ? <p role="alert" className="font-semibold text-severe">Your links could not load. Retrying...</p> : null}
        {links === null ? (
          <div className="h-28 animate-pulse rounded-card bg-sheet-sunk" />
        ) : active.length === 0 ? (
          <p className="rounded-card border border-rule bg-sheet p-4 text-ink-2">No active links. Nobody can see your records right now.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((l) => (
              <li key={l.id} className={cn("rounded-card border p-4 sm:p-5", l.is_break_glass ? "border-severe-rule bg-severe-soft" : "border-rule bg-sheet")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {l.is_break_glass ? (
                      <p className="flex items-center gap-1.5 font-bold text-severe"><WarningOctagon aria-hidden weight="fill" className="size-5" /> Emergency full access</p>
                    ) : null}
                    <p className="text-lead font-bold">{l.label ?? "Shared records"}</p>
                    <p className="text-ink-2">{describeScope({ type: l.scope_type, conditions: l.scope_conditions, months: l.scope_months })}</p>
                  </div>
                  <LiveBadge names={l.viewing_now} />
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-dense">
                  <div className="flex items-center gap-1.5"><Clock aria-hidden className="size-4 text-ink-2" /><dt className="sr-only">Ends</dt><dd>Ends in <span className="font-semibold">{remaining(l.expires_at)}</span></dd></div>
                  <div className="flex items-center gap-1.5"><Eye aria-hidden className="size-4 text-ink-2" /><dt className="sr-only">Views</dt><dd><span className="font-semibold">{l.views}</span> {l.views === 1 ? "view" : "views"}</dd></div>
                  {l.otp_code ? <div className="flex items-center gap-1.5"><Key aria-hidden className="size-4 text-ink-2" /><dt>Code</dt><dd className="font-mono font-semibold">{l.otp_code}</dd></div> : null}
                  {l.allow_write_back ? <div className="flex items-center gap-1.5"><NotePencil aria-hidden className="size-4 text-ink-2" /><dt className="sr-only">Doctor can add</dt><dd>Can add notes and prescriptions</dd></div> : null}
                </dl>
                <div className="mt-4 border-t border-rule pt-3">
                  {confirmRevoke === l.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">End access now?</p>
                      <button type="button" onClick={() => revoke(l.id)} className={buttonClass("danger", "dense")}>
                        <Prohibit aria-hidden className="size-5" /> Yes, end access
                      </button>
                      <button type="button" onClick={() => setConfirmRevoke(null)} className={buttonClass("quiet", "dense")}>Keep</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmRevoke(l.id)} className={buttonClass("danger", "dense")}>
                      <Prohibit aria-hidden className="size-5" /> End access
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length ? (
        <details className="group rounded-card border border-rule bg-sheet p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
            Past links ({past.length})
            <span className="text-dense font-semibold text-primary group-open:hidden">Show</span>
          </summary>
          <ul className="mt-3 divide-y divide-rule">
            {past.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span>
                  <span className="font-semibold">{l.label ?? "Shared records"}</span>
                  <span className="text-ink-2"> {describeScope({ type: l.scope_type, conditions: l.scope_conditions, months: l.scope_months })}</span>
                </span>
                <span className="text-dense text-ink-2">{l.status === "revoked" ? "Ended by you" : "Expired"}, {l.views} {l.views === 1 ? "view" : "views"}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
