import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { consolidate, courseEnded, isCurrent, safetyWarnings, type SafetyMed } from "./engine";
import { recentTests, validTestsValue } from "./test-saver";
import { todayIST } from "@/lib/format";

type Db = SupabaseClient<Database>;
const MED_COLUMNS =
  "id, brand_name, generic_name, generics, recognised, prescriber, start_date, duration_days, dose, frequency, source_document_id, verified_by_patient, active, stopped_on";


/** Current medicines (grouped), finished courses, stopped history and every current safety warning. */
export async function loadMedicines(db: Db, patientId: string) {
  const [meds, allergies] = await Promise.all([
    db.from("medications").select(MED_COLUMNS).eq("patient_id", patientId),
    db.from("allergies").select("id, substance, severity").eq("patient_id", patientId),
  ]);
  if (meds.error || allergies.error) throw new Error("medicines unavailable");
  const today = todayIST();
  const active = meds.data.filter((m) => isCurrent(m, today)) as SafetyMed[];
  // Courses whose written length has run out leave "taking now" by themselves.
  const finished = meds.data
    .filter((m) => m.active && courseEnded(m, today))
    .map((m) => ({ ...m, ended_on: courseEnded(m, today)! }))
    .sort((a, b) => b.ended_on.localeCompare(a.ended_on));
  const stopped = meds.data.filter((m) => !m.active).sort((a, b) => (b.stopped_on ?? "").localeCompare(a.stopped_on ?? ""));
  const generics = [...new Set(active.flatMap((m) => m.generics))];

  const [interactions, classes] = generics.length
    ? await Promise.all([
        db.from("drug_interactions").select("generic_a, generic_b, severity").in("generic_a", generics).in("generic_b", generics),
        db.from("generics").select("generic, drug_class").in("generic", generics),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (interactions.error || classes.error) throw new Error("reference data unavailable");

  const groups = consolidate(active);
  const warnings = safetyWarnings({
    groups,
    allergies: allergies.data,
    interactions: interactions.data as { generic_a: string; generic_b: string; severity: "major" | "moderate" | "minor" }[],
    classes: classes.data,
  });
  return { groups, finished, stopped, warnings, unrecognised: groups.filter((g) => !g.current.recognised) };
}

export async function loadTestSaver(db: Db, patientId: string) {
  const [labs, validity] = await Promise.all([
    db.from("lab_results").select("test_code, test_date, source_document_id, facility").eq("patient_id", patientId).not("test_code", "is", null),
    db.from("test_validity").select("test_code, test_name, validity_days, typical_price_inr"),
  ]);
  if (labs.error || validity.error) throw new Error("tests unavailable");
  const tests = recentTests(labs.data, validity.data, todayIST());
  return { tests, validValueInr: validTestsValue(tests) };
}
