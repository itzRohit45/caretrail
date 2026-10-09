import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Circle, CaretRight } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const { count: allergyCount } = await supabase
    .from("allergies")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patient.id);

  const checks = [
    { done: Boolean(patient.blood_group), label: "Blood group", detail: patient.blood_group ?? "Not added yet" },
    {
      done: (allergyCount ?? 0) > 0,
      label: "Allergies",
      detail: allergyCount ? `${allergyCount} recorded` : "None recorded. Add any you have.",
    },
    {
      done: Boolean(patient.emergency_contact_phone),
      label: "Emergency contact",
      detail: patient.emergency_contact_name ?? "Not added yet",
    },
  ];
  const firstName = patient.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <h1 className="text-display font-bold">
        {greeting()}, {firstName}
      </h1>

      <Card className="p-5">
        <h2 className="text-title font-bold">Ready for an emergency?</h2>
        <p className="mt-1 text-ink-2">If you cannot speak, a hospital will see these first.</p>
        <ul className="mt-4 divide-y divide-rule">
          {checks.map((c) => (
            <li key={c.label}>
              <Link href="/profile" className="flex min-h-16 items-center gap-3 rounded-control py-2 hover:bg-sheet-sunk">
                {c.done ? (
                  <CheckCircle aria-hidden weight="fill" className="size-7 shrink-0 text-verified" />
                ) : (
                  <Circle aria-hidden className="size-7 shrink-0 text-ink-3" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {c.label}
                    <span className="sr-only">{c.done ? ", done" : ", to do"}</span>
                  </span>
                  <span className="block text-dense text-ink-2">{c.detail}</span>
                </span>
                <CaretRight aria-hidden className="size-5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
