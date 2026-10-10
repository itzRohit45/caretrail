import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, CircleDashed, CaretRight, PencilSimple, Plus, WarningOctagon, Warning, Pill, Receipt, QrCode } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader, SheetSection } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { EmergencyPreview } from "@/components/patient/emergency-preview";
import { RecordRow } from "@/components/records/recent-records";
import { EmptyState } from "@/components/ui/empty-state";
import { RangeLine } from "@/components/ui/range-line";
import { loadTrends, type TrendPoint } from "@/lib/records/trends";
import { formatDate } from "@/lib/format";
import { loadMedicines, loadTestSaver } from "@/lib/safety/load";
import { cookies } from "next/headers";
import { DISMISS_COOKIE, loadAlerts, parseDismissed } from "@/lib/alerts";
import { HomeAlerts } from "@/components/alerts/home-alerts";
import { SAFETY_NOTE } from "@/lib/safety/engine";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [{ data: allergies }, { data: docs }] = await Promise.all([
    supabase.from("allergies").select("*").eq("patient_id", patient.id).order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, type, doc_date, created_at, facility, doctor_name, extraction_status, uploaded_by")
      .eq("patient_id", patient.id)
      .eq("upload_status", "uploaded")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const [meds, saver] = await Promise.all([loadMedicines(supabase, patient.id), loadTestSaver(supabase, patient.id)]);
  const urgent = meds.warnings.filter((w) => w.level !== "info");
  const doctors = new Set(meds.groups.map((g) => g.current.prescriber).filter(Boolean)).size;
  const validTests = saver.tests.filter((t) => t.valid);
  const latest = (await loadTrends(supabase, patient.id))
    .filter((t) => t.key !== "BP" && t.points.length > 0)
    .map((t) => ({ trend: t, point: t.points.at(-1) as TrendPoint }))
    .slice(0, 3);
  // Fill Latest results from the newest lab report for tests without a trend chart (blood count,
  // liver tests...), out-of-range values first, each with the range printed on the report.
  const { data: recentLabs } = latest.length < 3
    ? await supabase
        .from("lab_results")
        .select("id, test_name, test_code, value, value_text, unit, ref_low, ref_high, test_date, source_document_id")
        .eq("patient_id", patient.id)
        .order("test_date", { ascending: false })
        .limit(60)
    : { data: [] };
  const shownCodes = new Set<string>(latest.map((l) => l.trend.key.toUpperCase())); // "HbA1c" -> "HBA1C"
  const newestDate = recentLabs?.find((l) => !["BP_SYS", "BP_DIA"].includes(l.test_code ?? ""))?.test_date;
  const outside = (l: { value: number | null; ref_low: number | null; ref_high: number | null }) =>
    l.value !== null && ((l.ref_low !== null && l.value < l.ref_low) || (l.ref_high !== null && l.value > l.ref_high));
  const extraLabs = (recentLabs ?? [])
    .filter((l) => l.test_date === newestDate && !["BP_SYS", "BP_DIA"].includes(l.test_code ?? "") && !shownCodes.has(l.test_code ?? ""))
    .sort((a, b) => Number(outside(b)) - Number(outside(a)))
    .slice(0, 3 - latest.length);
  const alerts = await loadAlerts(supabase, patient.id, meds.warnings);
  const dismissed = parseDismissed((await cookies()).get(DISMISS_COOKIE)?.value);
  // The medicine card below already covers warnings; Home shows the other alerts the patient has not dismissed.
  const homeAlerts = alerts.filter((a) => a.kind !== "meds" && !dismissed.has(a.id));

  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const checks = [
    { done: Boolean(patient.blood_group), label: "Blood group", detail: patient.blood_group ?? "Not added" },
    { done: (allergies?.length ?? 0) > 0, label: "Allergies", detail: allergies?.length ? `${allergies.length} recorded` : "None recorded" },
    { done: Boolean(patient.emergency_contact_phone), label: "Emergency contact", detail: patient.emergency_contact_name ?? "Not added" },
  ];
  const done = checks.filter((c) => c.done).length;

  return (
    <>
      <PageHeader
        kicker={today}
        title={
          <>
            {greeting()}, <em className="italic">{patient.name.split(" ")[0]}</em>
          </>
        }
        subtitle={
          done === checks.length
            ? "Your emergency details are complete. A hospital can see what matters if you cannot speak."
            : "A few details will make your record safe in an emergency. It takes two minutes."
        }
      />
      <PageBody>
        <HomeAlerts alerts={homeAlerts} />
        {urgent.length ? (
          <section aria-labelledby="warn-title" className={cn("rounded-card border p-5 sm:p-6", urgent.some((w) => w.level === "severe") ? "border-severe-rule bg-severe-soft" : "border-rule bg-sheet")}>
            <h2 id="warn-title" className="flex items-center gap-2 text-title font-bold">
              {urgent.some((w) => w.level === "severe") ? <WarningOctagon aria-hidden weight="fill" className="size-6 text-severe" /> : <Warning aria-hidden weight="fill" className="size-6" />}
              {urgent.length === 1 ? "1 medicine warning" : `${urgent.length} medicine warnings`}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {/* Compact: the serious ones by name, the rest as a count. All are on the Medicines page. */}
              {(urgent.some((w) => w.level === "severe") ? urgent.filter((w) => w.level === "severe") : urgent).slice(0, 2).map((w) => (
                <li key={w.id} className={cn("font-semibold", w.level === "severe" ? "text-severe" : "text-ink")}>
                  {w.title}
                </li>
              ))}
              {urgent.length > Math.min(2, urgent.filter((w) => w.level === "severe").length || 2) ? (
                <li className="text-ink-2">and {urgent.length - Math.min(2, urgent.filter((w) => w.level === "severe").length || 2)} more to discuss with your doctor</li>
              ) : null}
            </ul>
            <p className="mt-3 text-dense text-ink-2">{SAFETY_NOTE}</p>
            <Link href="/medicines" className={buttonClass("secondary", "dense", "mt-4")}>
              Review medicines <CaretRight aria-hidden className="size-4" />
            </Link>
          </section>
        ) : null}

        {meds.groups.length || saver.tests.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/medicines" className="rounded-card border border-rule bg-sheet p-5 transition-colors duration-150 hover:border-rule-strong">
              <p className="flex items-center gap-2 font-bold"><Pill aria-hidden weight="duotone" className="size-5 text-primary" /> Taking now</p>
              <p className="mt-2 font-serif text-display font-medium tabular-nums">{meds.groups.length}</p>
              <p className="text-ink-2">{meds.groups.length === 1 ? "medicine" : "medicines"}{doctors ? ` from ${doctors} ${doctors === 1 ? "doctor" : "doctors"}` : ""}</p>
              {meds.groups.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {meds.groups.slice(0, 6).map((g) => (
                    <li key={g.key} className="rounded-pill bg-sheet-sunk px-2.5 py-1 text-dense font-semibold">{g.current.brand_name}</li>
                  ))}
                  {meds.groups.length > 6 ? <li className="px-1 py-1 text-dense text-ink-2">+{meds.groups.length - 6} more</li> : null}
                </ul>
              ) : null}
            </Link>
            <section aria-labelledby="saver-title" className="rounded-card border border-rule bg-sheet p-5">
              <h2 id="saver-title" className="flex items-center gap-2 font-bold"><Receipt aria-hidden weight="duotone" className="size-5 text-primary" /> Tests still valid</h2>
              {validTests.length ? (
                <>
                  <p className="mt-2 font-serif text-display font-medium tabular-nums">About ₹{saver.validValueInr.toLocaleString("en-IN")}</p>
                  <p className="text-ink-2">of recent tests you may not need to repeat yet. Show these reports before re-testing.</p>
                  <ul className="mt-3 space-y-1 text-dense">
                    {validTests.slice(0, 3).map((t) => (
                      <li key={t.code}>
                        <Link href={`/records/${t.documentId}`} className="font-semibold text-primary hover:underline">{t.name}</Link>
                        <span className="text-ink-2">, {t.daysAgo} days ago, next due {formatDate(t.nextDue)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-meta text-ink-3">Estimate from typical Chennai lab prices.</p>
                </>
              ) : saver.tests.length ? (
                <>
                  <p className="mt-2 text-ink-2">None are still valid. These are due again; your doctor decides whether to repeat them.</p>
                  <ul className="mt-3 space-y-1 text-dense">
                    {saver.tests.slice(0, 3).map((t) => (
                      <li key={t.code}>
                        <Link href={`/records/${t.documentId}`} className="font-semibold text-primary hover:underline">{t.name}</Link>
                        <span className="text-ink-2">, last done {formatDate(t.lastDate)}, due again since {formatDate(t.nextDue)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-ink-2">None right now. Recent lab reports appear here with the date they are next due.</p>
              )}
            </section>
          </div>
        ) : null}

        {latest.length || extraLabs.length ? (
          <section aria-labelledby="latest-title">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="latest-title" className="text-title font-bold">Latest results</h2>
              <Link href="/records/trends" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
                See trends <CaretRight aria-hidden className="size-4" />
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map(({ trend, point }) => (
                <li key={trend.key}>
                  <Link href={`/records/${point.documentId}`} className="block rounded-card border border-rule bg-sheet p-4 transition-colors duration-150 hover:border-rule-strong">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{trend.title}</span>
                      <span className="text-meta text-ink-2">{formatDate(point.date)}</span>
                    </p>
                    <p className="mt-1 font-serif text-display font-medium tabular-nums">
                      {point.value} <span className="font-sans text-body text-ink-2">{trend.unit}</span>
                    </p>
                    {trend.range ? <RangeLine value={point.value} low={trend.range.low} high={trend.range.high} unit={trend.unit} className="mt-2" /> : null}
                  </Link>
                </li>
              ))}
              {extraLabs.map((l) => (
                <li key={l.id}>
                  <Link href={`/records/${l.source_document_id}`} className="block rounded-card border border-rule bg-sheet p-4 transition-colors duration-150 hover:border-rule-strong">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{l.test_name}</span>
                      <span className="shrink-0 text-meta text-ink-2">{formatDate(l.test_date)}</span>
                    </p>
                    <p className="mt-1 font-serif text-display font-medium tabular-nums">
                      {l.value ?? l.value_text} <span className="font-sans text-body text-ink-2">{l.unit}</span>
                    </p>
                    {l.value !== null && (l.ref_low !== null || l.ref_high !== null) ? <RangeLine value={l.value} low={l.ref_low} high={l.ref_high} unit={l.unit ?? undefined} className="mt-2" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="records-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="records-title" className="text-title font-bold">Your records</h2>
              <p className="mt-1 text-ink-2">Prescriptions, lab reports and hospital papers you have added.</p>
            </div>
            <Link href="/upload" className={buttonClass("primary", "dense", "shrink-0 self-start")}>
              <Plus aria-hidden weight="bold" className="size-5" />
              Add a record
            </Link>
          </div>
          {docs?.length ? (
            <ul className="mt-4 divide-y divide-rule">
              {docs.map((d) => (
                <RecordRow key={d.id} doc={d} />
              ))}
            </ul>
          ) : null}
          {docs?.length ? (
            <Link href="/records" className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
              See all records <CaretRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Add your first record"
                body="Take a photo of a prescription or upload a lab report PDF. CareTrail reads it and you check it before anything is saved."
                action={
                  <Link href="/upload" className={buttonClass("primary")}>
                    <Plus aria-hidden weight="bold" className="size-5" /> Add a record
                  </Link>
                }
              />
            </div>
          )}
        </section>

        <div className="grid items-start gap-6 md:grid-cols-[1fr_1.1fr]">
          <SheetSection
            id="ready"
            title="Ready for an emergency"
            description={`${done} of ${checks.length} details added`}
          >
            <ul className="-mx-2 divide-y divide-rule">
              {checks.map((c) => (
                <li key={c.label}>
                  <Link href="/profile" className="flex min-h-15 items-center gap-3 rounded-control px-2 transition-colors duration-150 hover:bg-sheet-sunk">
                    {c.done ? (
                      <CheckCircle aria-hidden weight="fill" className="size-6 shrink-0 text-verified" />
                    ) : (
                      <CircleDashed aria-hidden weight="bold" className="size-6 shrink-0 text-ink-3" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {c.label}
                        <span className="sr-only">{c.done ? ", done" : ", to do"}</span>
                      </span>
                      <span className={c.done ? "block text-dense text-ink-2" : "block text-dense font-semibold text-primary"}>
                        {c.done ? c.detail : `Add ${c.label.toLowerCase()}`}
                      </span>
                    </span>
                    <CaretRight aria-hidden className="size-5 shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </SheetSection>

          <SheetSection
            id="card"
            title="Your emergency card"
            description="What a hospital sees if you cannot speak."
            action={
              <Link href="/profile" className={buttonClass("secondary", "dense")}>
                <PencilSimple aria-hidden className="size-4" />
                Edit
              </Link>
            }
          >
            <EmergencyPreview patient={patient} allergies={allergies ?? []} />
            <Link href="/emergency-card" className={buttonClass(patient.emergency_token_hash ? "secondary" : "primary", "dense", "mt-4")}>
              <QrCode aria-hidden weight="bold" className="size-5" />
              {patient.emergency_token_hash ? "Emergency QR" : "Set up emergency QR"}
            </Link>
          </SheetSection>
        </div>
      </PageBody>
    </>
  );
}
