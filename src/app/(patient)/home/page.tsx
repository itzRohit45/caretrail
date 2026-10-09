import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, CircleDashed, CaretRight, PencilSimple, Plus } from "@phosphor-icons/react/ssr";
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
      .select("id, type, doc_date, created_at, facility, doctor_name, extraction_status")
      .eq("patient_id", patient.id)
      .eq("upload_status", "uploaded")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const latest = (await loadTrends(supabase, patient.id))
    .filter((t) => t.key !== "BP" && t.points.length > 0)
    .map((t) => ({ trend: t, point: t.points.at(-1) as TrendPoint }))
    .slice(0, 3);
  const waiting = (docs ?? []).filter((d) => d.extraction_status === "needs_review" || d.extraction_status === "failed");

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
        {waiting.length ? (
          <section aria-labelledby="waiting-title" className="rounded-card border border-verify-rule bg-verify-soft p-5 sm:p-6">
            <h2 id="waiting-title" className="text-title font-bold text-ink">
              {waiting.length === 1 ? "1 record needs your check" : `${waiting.length} records need your check`}
            </h2>
            <p className="mt-1 text-ink-2">Nothing is added to your record until you check it.</p>
            <ul className="mt-3 divide-y divide-verify-rule">
              {waiting.map((d) => (
                <RecordRow key={d.id} doc={d} />
              ))}
            </ul>
          </section>
        ) : null}

        {latest.length ? (
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
          </SheetSection>
        </div>
      </PageBody>
    </>
  );
}
