import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, CircleDashed, CaretRight, PencilSimple } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader, SheetSection } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { EmergencyPreview } from "@/components/patient/emergency-preview";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const { data: allergies } = await supabase
    .from("allergies")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: true });

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
