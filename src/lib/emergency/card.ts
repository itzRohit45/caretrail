import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { ageFrom, todayIST } from "@/lib/format";
import { consolidate, isCurrent, type SafetyMed } from "@/lib/safety/engine";
import { decodeFrequency } from "@/lib/normalise/frequency";
import { CONDITION_LABELS, preferredConditionName } from "@/lib/normalise/conditions";
import type { Row } from "@/lib/db/types";

export type EmergencyCard = {
  name: string;
  age: number | null;
  sex: string | null;
  blood_group: string | null;
  allergies: { substance: string; severity: string; reaction: string | null }[];
  medicines: { name: string; generic: string | null; dose: string | null; frequency: string | null }[];
  conditions: string[];
  contact: { name: string | null; phone: string | null };
};

const MAJOR = ["diabetes", "hypertension", "cardiac", "thyroid", "asthma"];

/** Tier 1: the critical subset only. No documents, no lab history, no doctors' names. */
export async function buildEmergencyCard(patient: Row<"patients">): Promise<EmergencyCard> {
  const db = adminClient();
  const [allergies, meds, conds] = await Promise.all([
    db.from("allergies").select("substance, severity, reaction").eq("patient_id", patient.id),
    db.from("medications").select("*").eq("patient_id", patient.id).eq("active", true),
    db.from("conditions").select("name, category").eq("patient_id", patient.id).eq("status", "active"),
  ]);
  const today = todayIST();
  const groups = consolidate((meds.data ?? []).filter((m) => isCurrent(m, today)) as SafetyMed[]);
  const conditions = MAJOR.flatMap((cat) => {
    const names = (conds.data ?? []).filter((c) => c.category === cat).map((c) => c.name);
    if (!names.length) return [];
    const best = preferredConditionName(cat, names);
    return [`${CONDITION_LABELS[cat]}${best.length > 4 ? ` (${best})` : ""}`];
  });
  return {
    name: patient.name,
    age: ageFrom(patient.dob),
    sex: patient.sex,
    blood_group: patient.blood_group,
    allergies: allergies.data ?? [],
    medicines: groups.map((g) => ({ name: g.current.brand_name, generic: g.current.generic_name, dose: g.current.dose, frequency: decodeFrequency(g.current.frequency) ?? g.current.frequency })),
    conditions,
    contact: { name: patient.emergency_contact_name, phone: patient.emergency_contact_phone },
  };
}
