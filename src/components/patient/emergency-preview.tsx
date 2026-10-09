import Link from "next/link";
import { Phone, WarningOctagon, ShieldCheck } from "@phosphor-icons/react/ssr";
import { ageFrom } from "@/lib/format";
import type { Row } from "@/lib/db/types";

/** What a hospital sees if the patient cannot speak. Built only from saved profile data. */
export function EmergencyPreview({ patient, allergies }: { patient: Row<"patients">; allergies: Row<"allergies">[] }) {
  const age = ageFrom(patient.dob);
  const facts = [age !== null ? `${age} years` : null, patient.sex ? patient.sex[0].toUpperCase() + patient.sex.slice(1) : null]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="emergency-surface overflow-hidden rounded-card border border-rule-strong bg-sheet text-ink">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-title font-extrabold break-words">{patient.name}</p>
          <p className="text-ink-2">{facts || <Link href="/profile" className="font-semibold text-primary underline">Add age and sex</Link>}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-control border-2 border-ink px-3 py-1.5">
          <span className="text-meta font-semibold text-ink-2">Blood</span>
          {patient.blood_group ? (
            <span className="text-display leading-none font-extrabold">{patient.blood_group}</span>
          ) : (
            <Link href="/profile" className="py-1 text-dense font-semibold text-primary underline">
              Add
            </Link>
          )}
        </div>
      </div>
      {allergies.length > 0 ? (
        <div className="flex gap-3 bg-severe px-5 py-3 text-on-primary">
          <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-6 shrink-0" />
          <p className="font-bold">
            Allergic to{" "}
            {allergies.map((a, i) => (
              <span key={a.id}>
                {i > 0 ? ", " : ""}
                {a.substance}
                {a.severity === "severe" ? " (severe)" : ""}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 border-y border-rule bg-sheet-sunk px-5 py-3">
          <ShieldCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-ink-2" />
          <p className="font-semibold text-ink-2">No known allergies recorded</p>
        </div>
      )}
      <div className="p-5">
        {patient.emergency_contact_phone ? (
          <p className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-pill bg-ink text-sheet">
              <Phone aria-hidden weight="fill" className="size-5" />
            </span>
            <span>
              <span className="block font-bold">{patient.emergency_contact_name ?? "Emergency contact"}</span>
              <span className="block font-mono text-ink-2 tabular-nums">{patient.emergency_contact_phone}</span>
            </span>
          </p>
        ) : (
          <Link href="/profile" className="font-semibold text-primary underline">
            Add someone hospitals can call
          </Link>
        )}
      </div>
    </div>
  );
}
