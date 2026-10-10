"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Prohibit, FilePlus, NotePencil, FileText, WarningOctagon, Warning, Info, ArrowUpRight, ArrowDownRight, ArrowRight, Clock, X, CircleNotch, Eye, LockKey, UserCheck, Siren } from "@phosphor-icons/react";
import type { Brief, SinceLastVisit, Source } from "@/lib/brief/build";
import { Wordmark } from "@/components/wordmark";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { SourceViewer } from "@/components/records/source-viewer";
import { cn } from "@/lib/cn";
import { putWithProgress, sha256 } from "@/lib/upload-client";

type WriteBackData = {
  notes: { id: string; doctor_name: string; note: string; created_at: string }[];
  uploads: { id: string; filename: string | null; status: string; created_at: string }[];
};
type Loaded = Brief & { viewer: string; break_glass: boolean; write_back: WriteBackData | null };
type Phase =
  | { name: "checking" }
  | { name: "ended" }
  | { name: "limited" }
  | { name: "gate"; requireOtp: boolean; error?: string; busy?: boolean }
  | { name: "loading" }
  | { name: "ready"; brief: Loaded };
type Opened = { id: string; quote: string | null; title: string } | null;

const SHORT: Record<string, string> = { prescription: "Rx", lab_report: "Lab", discharge_summary: "Discharge", scan_report: "Scan", other: "Doc" };
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(`${iso}T00:00:00+05:30`));
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
// The sample doctor link (landing page) is pre-filled as Ravi's diabetologist, who last viewed on 20 Aug.
const SAMPLE_DOCTOR = { name: "Dr. A. Suresh", reg: "TNMC 61234" };
const isSample = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sample") === "1";
const cap = (s: string | null) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "");

function countdown(iso: string, now: number) {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Ended() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-pill bg-sheet-sunk">
        <Prohibit aria-hidden weight="bold" className="size-8 text-ink-2" />
      </span>
      <h1 className="mt-6 font-serif text-display font-medium">Access ended</h1>
      <p className="mt-3 text-lead text-ink-2">This link has expired or the patient has ended access. Ask the patient for a new link.</p>
      <p className="mt-10"><Wordmark /></p>
    </main>
  );
}

function SourceKey({ source }: { source: Source }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-meta font-semibold text-primary">
      <FileText aria-hidden className="size-4" />
      {SHORT[source.type] ?? "Doc"} {day(source.date)}
    </span>
  );
}

function Fact({ source, onOpen, title, children }: { source: Source; onOpen: (o: Opened) => void; title: string; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen({ id: source.document_id, quote: source.quote, title })}
        className="flex min-h-11 w-full flex-col gap-1 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-primary-soft sm:flex-row sm:items-start sm:justify-between sm:gap-3"
        aria-label={`${title}. Open source: ${source.facility ?? "document"}, ${day(source.date)}`}
      >
        <span className="min-w-0 flex-1">{children}</span>
        {/* Phones: the source sits under the fact so the fact keeps the full width. */}
        <SourceKey source={source} />
      </button>
    </li>
  );
}

function Allergies({ allergies }: { allergies: Brief["allergies"] }) {
  return (
    <section aria-label="Allergies" className={cn("rounded-card border p-4", allergies.length ? "border-severe-rule bg-severe-soft" : "border-rule bg-sheet")}>
      <h2 className={cn("mb-1 flex items-center gap-2 font-bold", allergies.length > 0 && "text-severe")}>
        {allergies.length ? <WarningOctagon aria-hidden weight="fill" className="size-5" /> : null} Allergies
      </h2>
      {allergies.length ? (
        <ul className="space-y-0.5">
          {allergies.map((a) => (
            <li key={a.substance}><span className="font-bold">{a.substance}</span> ({a.severity}){a.reaction ? `, ${a.reaction}` : ""}</li>
          ))}
        </ul>
      ) : (
        <p>No known allergies recorded.</p>
      )}
      <p className="mt-1 text-meta text-ink-2">Entered by the patient.</p>
    </section>
  );
}

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border border-rule bg-sheet p-4">
      <h2 className="mb-2 flex items-baseline gap-2 font-bold">
        {title}
        {count !== undefined ? <span className="text-meta font-semibold text-ink-3">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

export function DoctorView() {
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const [name, setName] = useState(() => (isSample() ? SAMPLE_DOCTOR.name : ""));
  const [regNo, setRegNo] = useState(() => (isSample() ? SAMPLE_DOCTOR.reg : ""));
  const [tab, setTab] = useState<"since" | "brief">("since");
  const [otp, setOtp] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [opened, setOpened] = useState<Opened>(null);
  const token = useRef<string>("");
  const session = useRef<string>("");

  const headers = useCallback(() => ({ "x-share-token": token.current, "x-viewer-session": session.current }), []);
  const end = useCallback(() => {
    session.current = "";
    sessionStorage.removeItem("ct-viewer");
    setOpened(null);
    setPhase({ name: "ended" });
  }, []);

  const loadBrief = useCallback(async () => {
    setPhase({ name: "loading" });
    const res = await fetch("/api/s/brief", { headers: headers() }).catch(() => null);
    if (!res || res.status === 410) return end();
    if (res.status === 401) return setPhase({ name: "gate", requireOtp: false });
    if (res.status === 429) return setPhase({ name: "limited" });
    const body = await res.json();
    if (!res.ok) return setPhase({ name: "gate", requireOtp: false, error: body.error?.message });
    setPhase({ name: "ready", brief: body.data });
    // A ?doc=<id> link opens that document directly (and is refused, and logged, if out of scope).
    const doc = new URLSearchParams(window.location.search).get("doc");
    if (doc) setOpened({ id: doc, quote: null, title: "Requested document" });
  }, [end, headers]);

  // Start: token from the URL fragment (never sent to the server in the URL), then status or resume.
  useEffect(() => {
    token.current = window.location.hash.slice(1);
    const saved = sessionStorage.getItem("ct-viewer");
    if (saved?.startsWith(`${token.current.slice(0, 10)}:`)) session.current = saved.split(":")[1];
    (async () => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token.current)) return end();
      if (session.current) return loadBrief();
      const res = await fetch("/api/s/status", { headers: { "x-share-token": token.current } }).catch(() => null);
      if (!res || res.status === 410) return end();
      if (res.status === 429) return setPhase({ name: "limited" });
      const body = await res.json();
      setPhase({ name: "gate", requireOtp: body.data.require_otp });
    })();
  }, [end, loadBrief]);

  // Heartbeat every 3 s, so a revocation or expiry always ends the session within the PRD's 5 seconds.
  useEffect(() => {
    if (phase.name !== "ready") return;
    const beat = setInterval(async () => {
      const res = await fetch("/api/s/heartbeat", { headers: headers() }).catch(() => null);
      if (res?.status === 410) end();
    }, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(beat);
      clearInterval(tick);
    };
  }, [phase.name, headers, end]);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    if (phase.name !== "gate") return;
    setPhase({ ...phase, busy: true, error: undefined });
    const res = await fetch("/api/s/open", { method: "POST", headers: { "content-type": "application/json", "x-share-token": token.current }, body: JSON.stringify({ viewer_name: name, reg_no: regNo, otp }) }).catch(() => null);
    if (!res || res.status === 410) return end();
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setPhase({ ...phase, busy: false, error: body.error?.fields?.[0]?.message ?? body.error?.message ?? "Could not open the records." });
    session.current = body.data.session_id;
    sessionStorage.setItem("ct-viewer", `${token.current.slice(0, 10)}:${session.current}`);
    loadBrief();
  }

  if (phase.name === "ended") return <Ended />;
  if (phase.name === "limited")
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-display font-medium">Please wait a minute</h1>
        <p className="mt-3 text-ink-2">Too many requests came from this network. Try again in a minute.</p>
      </main>
    );
  if (phase.name === "checking" || phase.name === "loading")
    return (
      <main className="flex min-h-dvh items-center justify-center" role="status">
        <CircleNotch aria-hidden weight="bold" className="size-8 animate-spin text-primary" />
        <span className="sr-only">Opening shared records</span>
      </main>
    );
  if (phase.name === "gate")
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <Wordmark />
        <h1 className="mt-8 font-serif text-display font-medium">Shared medical records</h1>
        <p className="mt-2 text-ink-2">A patient has shared part of their record with you. Enter your name to open it. The patient sees your name and the time you viewed.</p>
        <form onSubmit={open} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="viewer" className="mb-1 block font-semibold">Your name</label>
            <input id="viewer" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="reg" className="mb-1 block font-semibold">Registration number <span className="font-normal text-ink-3">(optional)</span></label>
            <p id="reg-help" className="mb-2 text-dense text-ink-2">Add it to see what changed since you last viewed this patient.</p>
            <input id="reg" value={regNo} onChange={(e) => setRegNo(e.target.value)} autoCapitalize="characters" aria-describedby="reg-help" className={cn(inputClass, "font-mono")} />
          </div>
          {isSample() ? (
            <p className="rounded-control bg-primary-soft px-3 py-2 text-dense text-primary">
              Sample link: filled in as Ravi&apos;s diabetologist, who last viewed this record on 20 Aug 2026. Change the name to see the record as a new doctor.
            </p>
          ) : null}
          {phase.requireOtp ? (
            <div>
              <label htmlFor="code" className="mb-1 block font-semibold">Code from the patient</label>
              <p id="code-help" className="mb-2 text-dense text-ink-2">Ask the patient to read the 6-digit code on their phone.</p>
              <input id="code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-describedby="code-help" className={cn(inputClass, "font-mono tracking-widest")} />
            </div>
          ) : null}
          {phase.error ? <p role="alert" className="font-semibold text-severe">{phase.error}</p> : null}
          <button type="submit" disabled={phase.busy} className={buttonClass("primary", "patient", "w-full")}>
            {phase.busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : <Eye aria-hidden className="size-5" />} Open records
          </button>
        </form>
        <p className="mt-6 flex items-center gap-2 text-dense text-ink-2"><LockKey aria-hidden className="size-5" /> Viewing is logged and ends when the patient says so.</p>
      </main>
    );

  const b = phase.brief;
  const severe = b.warnings.filter((w) => w.level === "severe");
  const caution = b.warnings.filter((w) => w.level === "caution");
  const minor = b.warnings.filter((w) => w.level === "info");
  const since = b.since_last_visit;
  const changes = since ? since.warnings.length + since.started.length + since.changed.length + since.stopped.length + since.labs.length + since.diagnoses.length + since.documents.length : 0;
  const view = since && changes > 0 ? tab : "brief";

  return (
    <div className="min-h-dvh text-dense">
      {/* Sticky only where there is room: on a phone four wrapped header rows would eat a fifth of the screen. */}
      <header className="border-b border-rule bg-sheet md:sticky md:top-0 md:z-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-serif text-title font-medium">{b.patient.name}</h1>
            <p className="text-ink-2">{[b.patient.age !== null ? `${b.patient.age} y` : null, cap(b.patient.sex)].filter(Boolean).join(", ")}</p>
          </div>
          <p className="rounded-control border-2 border-ink px-2 py-0.5 font-bold">Blood {b.patient.blood_group ?? "not recorded"}</p>
          <p className="rounded-pill bg-primary-soft px-3 py-1 font-semibold text-primary">{b.scope.description}</p>
          <p className="flex items-center gap-1.5 text-ink-2"><Clock aria-hidden className="size-4" /> Access ends in <span className="font-mono font-semibold text-ink tabular-nums">{countdown(b.scope.expires_at, now)}</span></p>
          {b.write_back ? (
            <a href="#wb-title" className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-rule-strong px-3 font-semibold text-primary hover:border-ink">
              <NotePencil aria-hidden className="size-4" /> Add to record
            </a>
          ) : null}
          <p className="ml-auto text-ink-2">Viewing as <span className="font-semibold text-ink">{b.viewer}</span></p>
        </div>
      </header>

      {b.break_glass ? (
        <p role="note" className="mx-auto mt-4 flex max-w-7xl items-start gap-2 px-4 font-semibold text-severe">
          <Siren aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
          Emergency full access. Your name, hospital and registration number are recorded, and the patient and their emergency contact have been alerted.
        </p>
      ) : null}
      {since && changes === 0 ? (
        <p className="mx-auto mt-4 max-w-7xl px-4 text-ink-2">Nothing new is dated after your last view on <span className="font-semibold text-ink">{dayOf(since.at)}</span>.</p>
      ) : null}
      {since && changes > 0 ? (
        <div className="mx-auto mt-4 flex max-w-7xl flex-wrap gap-2 px-4" aria-label="Brief views">
          <button type="button" aria-pressed={view === "since"} onClick={() => setTab("since")} className={cn("inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 font-semibold", view === "since" ? "border-primary bg-primary text-on-primary" : "border-rule-strong bg-sheet text-ink hover:border-ink")}>
            Since your last view, {dayOf(since.at)}
            <span className={cn("rounded-pill px-2 text-meta font-bold tabular-nums", view === "since" ? "bg-sheet text-primary" : "bg-primary-soft text-primary")}>{changes}</span>
          </button>
          <button type="button" aria-pressed={view === "brief"} onClick={() => setTab("brief")} className={cn("inline-flex min-h-11 items-center rounded-pill border px-4 font-semibold", view === "brief" ? "border-primary bg-primary text-on-primary" : "border-rule-strong bg-sheet text-ink hover:border-ink")}>
            Full brief
          </button>
        </div>
      ) : null}
      {since && view === "since" ? (
        <SinceView since={since} allergies={b.allergies} onOpen={setOpened} />
      ) : (
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Allergies allergies={b.allergies} />

          <Panel title="Safety warnings" count={b.warnings.length}>
            {b.warnings.length === 0 ? (
              <p className="px-2 text-ink-2">None among the shared medicines.</p>
            ) : (
              <ul className="space-y-2">
                {[...severe, ...caution.slice(0, 3)].map((w) => (
                  <li key={w.id} className={cn("rounded-control p-2.5", w.level === "severe" ? "bg-severe-soft" : "bg-sheet-sunk")}>
                    <p className={cn("flex items-start gap-1.5 font-bold", w.level === "severe" && "text-severe")}>
                      {w.level === "severe" ? <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" /> : <Warning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />}
                      {w.title}
                    </p>
                    <p className="mt-0.5 text-ink-2">{w.detail}</p>
                  </li>
                ))}
                {/* Severe ones always show in full; a long tail of moderate ones folds so the brief stays one screen. */}
                {caution.length > 3 ? (
                  <li>
                    <details className="group rounded-control bg-sheet-sunk p-2.5">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-bold">
                        <Warning aria-hidden weight="fill" className="size-4 shrink-0" /> {caution.length - 3} more moderate warnings
                        <span className="ml-auto font-semibold text-primary group-open:hidden">Show</span>
                      </summary>
                      <ul className="mt-1 divide-y divide-rule">
                        {caution.slice(3).map((w) => (
                          <li key={w.id} className="py-2">
                            <p className="font-semibold">{w.title}</p>
                            <p className="text-ink-2">{w.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ) : null}
                {minor.length ? <li className="flex items-center gap-1.5 px-2 text-ink-2"><Info aria-hidden className="size-4" /> {minor.length} minor interaction{minor.length > 1 ? "s" : ""}</li> : null}
              </ul>
            )}
          </Panel>

          <Panel title="Conditions" count={b.conditions.length}>
            {b.conditions.length ? (
              <ul>
                {b.conditions.map((c) => (
                  <Fact key={c.label} source={c.sources[c.sources.length - 1]} onOpen={setOpened} title={c.names[0]}>
                    <span className="block font-semibold">{c.names[0]}</span>
                    <span className="block text-ink-2">{c.label}{c.since ? `, first recorded ${day(c.since)}` : ""}{c.sources.length > 1 ? `, on ${c.sources.length} documents` : ""}</span>
                  </Fact>
                ))}
              </ul>
            ) : <p className="px-2 text-ink-2">No diagnoses in the shared records.</p>}
          </Panel>
        </div>

        <Panel title="Current medicines" count={b.medicines.length}>
          {b.medicines.length ? (
            <ul className="divide-y divide-rule">
              {b.medicines.map((m) => (
                <Fact key={m.id} source={m.source} onOpen={setOpened} title={m.brand}>
                  <span className="flex flex-wrap items-center gap-x-2 font-bold">
                    {m.brand}
                    {m.verified_by_patient ? <span className="inline-flex items-center gap-1 text-meta font-semibold text-verified"><UserCheck aria-hidden className="size-4" /> Patient-verified</span> : null}
                    {!m.recognised ? <span className="text-meta font-semibold text-ink-2">Unrecognised name</span> : null}
                  </span>
                  <span className="block text-ink-2">{[cap(m.generic), m.dose, m.frequency].filter(Boolean).join(", ")}</span>
                  <span className="block text-meta text-ink-3">{m.prescriber ?? "Prescriber unknown"}{m.since ? `, since ${day(m.since)}` : ""}{m.repeats ? `, renewed ${m.repeats}×` : ""}</span>
                </Fact>
              ))}
            </ul>
          ) : <p className="px-2 text-ink-2">No current medicines in the shared records.</p>}
        </Panel>

        <div className="space-y-4">
          <Panel title="Key results" count={b.labs.length}>
            {b.labs.length ? (
              <ul className="divide-y divide-rule">
                {b.labs.map((l) => {
                  const diff = l.previous ? Math.round((l.value - l.previous.value) * 100) / 100 : null;
                  const Arrow = diff === null ? null : diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : ArrowRight;
                  return (
                    <Fact key={l.code} source={l.source} onOpen={setOpened} title={l.title}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{l.title}</span>
                        <span className="font-mono font-bold tabular-nums">{l.display} <span className="font-sans font-normal text-ink-2">{l.unit}</span></span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-ink-2">
                        {day(l.date)}
                        {l.out_of_range ? <span className="font-semibold text-ink">outside normal range</span> : null}
                        {Arrow && l.previous ? <span className="inline-flex items-center gap-0.5"><Arrow aria-hidden weight="bold" className="size-4" /> from {l.previous.value} ({day(l.previous.date)})</span> : null}
                        {l.verified_by_patient ? <span className="text-meta font-semibold text-verified">Patient-verified</span> : null}
                      </span>
                    </Fact>
                  );
                })}
              </ul>
            ) : <p className="px-2 text-ink-2">No lab results in the shared records.</p>}
          </Panel>

          <Panel title="Recent tests" count={b.recent_tests.length}>
            {b.recent_tests.length ? (
              <ul className="divide-y divide-rule">
                {b.recent_tests.map((t) => (
                  <li key={t.code} className="px-2 py-2">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-ink-2">{t.daysAgo} days ago, next due {day(t.nextDue)}</span>
                    </p>
                    {t.valid ? <p className="mt-0.5 inline-flex rounded-pill bg-primary-soft px-2 py-0.5 text-meta font-semibold text-primary">Recent, consider before re-ordering</p> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="px-2 text-ink-2">No tests in the shared records.</p>}
          </Panel>

          {b.hospitalisations.length ? (
            <Panel title="Hospitalisations" count={b.hospitalisations.length}>
              <ul>
                {b.hospitalisations.map((h) => (
                  <Fact key={h.source.document_id} source={h.source} onOpen={setOpened} title={`Discharge summary ${h.facility ?? ""}`}>
                    <span className="block font-semibold">{h.facility ?? "Hospital"}, discharged {day(h.date)}</span>
                    <span className="block text-ink-2">{h.diagnoses.join("; ")}</span>
                  </Fact>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Documents" count={b.documents.length}>
            <ul>
              {b.documents.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => setOpened({ id: d.id, quote: null, title: `${d.type_label}, ${d.facility ?? ""}` })} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-2 text-left hover:bg-primary-soft">
                    <span className="py-1.5"><span className="block font-semibold">{d.facility ?? d.type_label}</span>{d.facility ? <span className="block text-ink-2">{d.type_label}</span> : null}</span>
                    <span className="shrink-0 whitespace-nowrap text-meta font-semibold text-primary">{day(d.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </main>
      )}
      {b.write_back ? <WriteBack patientName={b.patient.name} initial={b.write_back} headers={headers} onEnded={end} /> : null}
      <footer className="mx-auto max-w-7xl px-4 pb-6 text-meta text-ink-3">
        Built only from the patient&apos;s stored records. Every line opens its source document. CareTrail is an information tool, not medical advice.
      </footer>

      {opened ? <SourceDialog opened={opened} headers={headers} onClose={() => setOpened(null)} onEnded={end} /> : null}
    </div>
  );
}

const UPLOAD_STATUS: Record<string, string> = {
  needs_review: "Waiting for the patient to check",
  completed: "Added to the record",
  failed: "Could not be read; the patient will enter it",
  skipped: "Not a medical document; nothing added",
  pending: "Uploading",
  processing: "Reading",
};
const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];
const timeOf = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** FR-14: on links where the patient allowed it, the doctor adds a note or a new prescription. */
function WriteBack({ patientName, initial, headers, onEnded }: { patientName: string; initial: WriteBackData; headers: () => Record<string, string>; onEnded: () => void }) {
  const first = patientName.split(" ")[0];
  const [notes, setNotes] = useState(initial.notes);
  const [uploads, setUploads] = useState(initial.uploads);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<{ busy?: boolean; error?: string; saved?: boolean }>({});
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [up, setUp] = useState<{ name: "idle" } | { name: "uploading"; percent: number } | { name: "reading" } | { name: "done"; text: string } | { name: "error"; text: string }>({ name: "idle" });

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    setNoteState({ busy: true });
    const res = await fetch("/api/s/notes", { method: "POST", headers: { ...headers(), "content-type": "application/json" }, body: JSON.stringify({ note }) }).catch(() => null);
    if (res?.status === 410) return onEnded();
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setNoteState({ error: body?.error?.fields?.[0]?.message ?? body?.error?.message ?? "The note could not be saved. Try again." });
    setNotes((n) => [body.data, ...n]);
    setNote("");
    setNoteState({ saved: true });
  }

  async function upload() {
    if (!file) return setUp({ name: "error", text: "Choose the prescription first." });
    if (!ACCEPT.includes(file.type)) return setUp({ name: "error", text: "Only PDF, JPG or PNG files can be uploaded." });
    if (file.size > 10 * 1048576) return setUp({ name: "error", text: `Files can be up to 10 MB. This one is ${(file.size / 1048576).toFixed(1)} MB.` });
    setUp({ name: "uploading", percent: 0 });
    const start = await fetch("/api/s/documents", {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ file_hash: await sha256(file), size_bytes: file.size, mime_type: file.type, original_filename: file.name }),
    }).catch(() => null);
    if (start?.status === 410) return onEnded();
    const started = await start?.json().catch(() => null);
    if (!start?.ok) return setUp({ name: "error", text: started?.error?.message ?? "The upload could not start. Try again." });
    try {
      await putWithProgress(started.data.upload_url, file, (percent) => setUp({ name: "uploading", percent }));
    } catch {
      return setUp({ name: "error", text: "The upload stopped. Check the connection and try again." });
    }
    setUp({ name: "reading" });
    const processed = await fetch(`/api/s/documents/${started.data.document_id}/process`, { method: "POST", headers: headers() }).catch(() => null);
    if (processed?.status === 410) return onEnded();
    const result = await processed?.json().catch(() => null);
    if (!processed?.ok) return setUp({ name: "error", text: result?.error?.message ?? "The prescription could not be read. Try again." });
    const status: string = result.data.status;
    setUploads((u) => [{ id: started.data.document_id, filename: file.name, status, created_at: new Date().toISOString() }, ...u.filter((x) => x.id !== started.data.document_id)]);
    setFile(null);
    setInputKey((k) => k + 1); // clears the chosen file from the input
    setUp({
      name: "done",
      text:
        status === "needs_review" ? `Sent to ${first} to check. It joins the record once they confirm the medicines and doses.`
        : status === "skipped" ? "This does not look like a medical document, so nothing was added."
        : `Saved, but it could not be read automatically. ${first} will enter it by hand.`,
    });
  }

  const busy = up.name === "uploading" || up.name === "reading";
  return (
    <section aria-labelledby="wb-title" className="mx-auto mb-4 max-w-7xl px-4">
      <div className="rounded-card border border-rule bg-sheet p-4">
        <h2 id="wb-title" className="scroll-mt-28 font-bold">Add to {first}&apos;s record</h2>
        <p className="text-ink-2">{first} allowed this link to add a note or a new prescription. Both are logged with your name, and {first} checks every prescription before it joins the record.</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveNote} noValidate className="space-y-2">
            <label htmlFor="wb-note" className="flex items-center gap-1.5 font-semibold"><NotePencil aria-hidden className="size-5" /> Note for {first}</label>
            <textarea id="wb-note" value={note} onChange={(e) => { setNote(e.target.value); setNoteState({}); }} rows={3} maxLength={2000} className={cn(inputClass, "min-h-24 py-2")} />
            {noteState.error ? <p role="alert" className="font-semibold text-severe">{noteState.error}</p> : null}
            {noteState.saved ? <p role="status" className="font-semibold text-verified">Note saved to {first}&apos;s record.</p> : null}
            <button type="submit" disabled={noteState.busy} className={buttonClass("secondary", "dense")}>
              {noteState.busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : null} Save note
            </button>
          </form>
          <div className="space-y-2">
            <label htmlFor="wb-file" className="flex items-center gap-1.5 font-semibold"><FilePlus aria-hidden className="size-5" /> New prescription</label>
            <input key={inputKey} id="wb-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUp({ name: "idle" }); }} className="block w-full rounded-control border border-rule-strong bg-sheet p-2 text-dense file:mr-3 file:min-h-10 file:rounded-pill file:border-0 file:bg-primary-soft file:px-4 file:font-semibold file:text-primary" />
            <p className="text-meta text-ink-2">PDF, JPG or PNG, up to 10 MB. Read by the same extraction as the patient&apos;s uploads.</p>
            {up.name === "uploading" ? <p role="status" className="font-semibold">Uploading {up.percent}%</p> : null}
            {up.name === "reading" ? <p role="status" className="flex items-center gap-2 font-semibold"><CircleNotch aria-hidden className="size-5 animate-spin" /> Reading the prescription</p> : null}
            {up.name === "done" ? <p role="status" className="font-semibold text-verified">{up.text}</p> : null}
            {up.name === "error" ? <p role="alert" className="font-semibold text-severe">{up.text}</p> : null}
            <button type="button" onClick={upload} disabled={busy} className={buttonClass("secondary", "dense")}>
              {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : <FilePlus aria-hidden className="size-5" />} Upload prescription
            </button>
          </div>
        </div>
        {notes.length || uploads.length ? (
          <div className="mt-4 border-t border-rule pt-3">
            <h3 className="font-semibold">Added through this link</h3>
            <ul className="mt-1 divide-y divide-rule">
              {uploads.map((u) => (
                <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="flex items-center gap-1.5"><FilePlus aria-hidden className="size-4 shrink-0" /> {u.filename ?? "Prescription"}</span>
                  <span className="text-ink-2">{UPLOAD_STATUS[u.status] ?? u.status}, {timeOf(u.created_at)}</span>
                </li>
              ))}
              {notes.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="whitespace-pre-line">{n.note}</p>
                  <p className="text-meta text-ink-3">{n.doctor_name}, {timeOf(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** FR-13: only what is dated after this doctor's previous view. Allergies stay on top. */
function SinceView({ since, allergies, onOpen }: { since: SinceLastVisit; allergies: Brief["allergies"]; onOpen: (o: Opened) => void }) {
  const medCount = since.started.length + since.changed.length + since.stopped.length;
  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
      <p className="text-ink-2 lg:col-span-3">
        Dated after your last view on <span className="font-semibold text-ink">{dayOf(since.at)}</span>. Everything else is under Full brief.
      </p>
      <div className="space-y-4">
        <Allergies allergies={allergies} />
        <Panel title="New warnings" count={since.warnings.length}>
          {since.warnings.length ? (
            <ul className="space-y-2">
              {since.warnings.map((w) => (
                <li key={w.id} className={cn("rounded-control p-2.5", w.level === "severe" ? "bg-severe-soft" : "bg-sheet-sunk")}>
                  <p className={cn("flex items-start gap-1.5 font-bold", w.level === "severe" && "text-severe")}>
                    {w.level === "severe" ? <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" /> : <Warning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />}
                    {w.title}
                  </p>
                  <p className="mt-0.5 text-ink-2">{w.detail}</p>
                </li>
              ))}
            </ul>
          ) : <p className="px-2 text-ink-2">No new warnings.</p>}
        </Panel>
      </div>

      <Panel title="Medicine changes" count={medCount}>
        {medCount ? (
          <ul className="divide-y divide-rule">
            {since.started.map((m) => (
              <Fact key={`s-${m.brand}`} source={m.source} onOpen={onOpen} title={`${m.brand} started`}>
                <span className="block"><span className="font-semibold">Started {m.brand}</span>{m.generic ? <span className="text-ink-2"> ({m.generic})</span> : null}</span>
                <span className="block text-ink-2">{m.detail || "Dose not written"}</span>
                <span className="block text-meta text-ink-3">{m.prescriber ?? "Prescriber unknown"}, {day(m.date)}</span>
              </Fact>
            ))}
            {since.changed.map((m) => (
              <Fact key={`c-${m.brand}`} source={m.source} onOpen={onOpen} title={`${m.brand} changed`}>
                <span className="block font-semibold">Changed {m.brand}</span>
                <span className="block text-ink-2">{m.from} <ArrowRight aria-label="to" className="inline size-4" /> {m.to}</span>
                <span className="block text-meta text-ink-3">{m.prescriber ?? "Prescriber unknown"}, {day(m.date)}</span>
              </Fact>
            ))}
            {since.stopped.map((m) => (
              <Fact key={`x-${m.brand}`} source={m.source} onOpen={onOpen} title={`${m.brand} stopped`}>
                <span className="block"><span className="font-semibold">Stopped {m.brand}</span>{m.generic ? <span className="text-ink-2"> ({m.generic})</span> : null}</span>
                <span className="block text-meta text-ink-3">Marked stopped by the patient, {day(m.stopped_on)}</span>
              </Fact>
            ))}
          </ul>
        ) : <p className="px-2 text-ink-2">No medicine changes.</p>}
      </Panel>

      <div className="space-y-4">
        <Panel title="New results" count={since.labs.length}>
          {since.labs.length ? (
            <ul className="divide-y divide-rule">
              {since.labs.map((l) => (
                <Fact key={l.code} source={l.source} onOpen={onOpen} title={l.title}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{l.title}</span>
                    <span className="font-mono font-bold tabular-nums">{l.display} <span className="font-sans font-normal text-ink-2">{l.unit}</span></span>
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-ink-2">
                    {day(l.date)}
                    {l.out_of_range ? <span className="font-semibold text-ink">outside normal range</span> : null}
                    {l.previous ? <span>was {l.previous.display} ({day(l.previous.date)})</span> : <span>first result</span>}
                  </span>
                </Fact>
              ))}
            </ul>
          ) : <p className="px-2 text-ink-2">No new results.</p>}
        </Panel>
        <Panel title="New diagnoses" count={since.diagnoses.length}>
          {since.diagnoses.length ? (
            <ul className="divide-y divide-rule">
              {since.diagnoses.map((d) => (
                <Fact key={d.name} source={d.source} onOpen={onOpen} title={d.name}>
                  <span className="block font-semibold">{d.name}</span>
                  <span className="block text-ink-2">{day(d.date)}</span>
                </Fact>
              ))}
            </ul>
          ) : <p className="px-2 text-ink-2">No new diagnoses.</p>}
        </Panel>
        <Panel title="New documents" count={since.documents.length}>
          {since.documents.length ? (
            <ul>
              {since.documents.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => onOpen({ id: d.id, quote: null, title: `${d.type_label}, ${d.facility ?? ""}` })} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-2 text-left hover:bg-primary-soft">
                    <span className="py-1.5"><span className="block font-semibold">{d.facility ?? d.type_label}</span>{d.facility ? <span className="block text-ink-2">{d.type_label}</span> : null}</span>
                    <span className="shrink-0 whitespace-nowrap text-meta font-semibold text-primary">{day(d.date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-2 text-ink-2">No new documents.</p>}
        </Panel>
      </div>
    </main>
  );
}

function SourceDialog({ opened, headers, onClose, onEnded }: { opened: NonNullable<Opened>; headers: () => Record<string, string>; onClose: () => void; onEnded: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<{ url: string; mime_type: string } | "denied" | "error" | null>(null);
  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    fetch(`/api/s/documents/${encodeURIComponent(opened.id)}/file`, { headers: headers() })
      .then(async (res) => {
        if (!live) return;
        if (res.status === 410) return onEnded();
        if (res.status === 403) return setFile("denied");
        setFile(res.ok ? (await res.json()).data : "error");
      })
      .catch(() => live && setFile("error"));
    return () => {
      live = false;
    };
  }, [opened.id, headers, onEnded]);

  return (
    <dialog ref={ref} onClose={onClose} className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-dense backdrop:bg-ink/40 md:m-auto md:h-[92dvh] md:max-w-5xl md:rounded-card" aria-label={`Source: ${opened.title}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-sheet px-4 py-3">
          <p className="font-bold">Source: {opened.title}</p>
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("quiet", "dense")} autoFocus>
            <X aria-hidden className="size-5" /> Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {file === null ? (
            <div className="h-64 animate-pulse rounded-card bg-sheet-sunk" />
          ) : file === "denied" ? (
            <div className="mx-auto max-w-md py-10 text-center">
              <Prohibit aria-hidden weight="bold" className="mx-auto size-10 text-ink-2" />
              <p className="mt-4 font-serif text-title font-medium">Outside what was shared</p>
              <p className="mt-2 text-ink-2">This document is not part of the records the patient shared with you. The attempt has been recorded.</p>
            </div>
          ) : file === "error" ? (
            <p className="text-ink-2">The document could not be opened. Close and try again.</p>
          ) : (
            <SourceViewer url={file.url} mimeType={file.mime_type} quote={opened.quote} />
          )}
        </div>
      </div>
    </dialog>
  );
}
