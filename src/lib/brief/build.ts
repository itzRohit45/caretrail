import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { ageFrom, todayIST } from "@/lib/format";
import { decodeFrequency } from "@/lib/normalise/frequency";
import { categoriesFor } from "@/lib/normalise/brands";
import { CONDITION_LABELS, preferredConditionName } from "@/lib/normalise/conditions";
import { consolidate, safetyWarnings, type SafetyMed, type SafetyWarning } from "@/lib/safety/engine";
import { recentTests, type RecentTest } from "@/lib/safety/test-saver";
import { describeScope, documentInScope, factInScope, labCategories, scopeFromLink } from "@/lib/sharing/scope";
import { DOC_TYPE_LABELS } from "@/lib/schemas/documents";
import type { Row } from "@/lib/db/types";

// The doctor brief is assembled from database rows only. No model writes any part of it,
// and every fact carries the document and the exact text it came from.

export type Source = { document_id: string; type: string; date: string; facility: string | null; quote: string | null };
export type BriefDocument = { id: string; type: string; type_label: string; date: string; facility: string | null; doctor: string | null };
export type Brief = {
  patient: { name: string; age: number | null; sex: string | null; blood_group: string | null };
  scope: { description: string; expires_at: string };
  allergies: { substance: string; severity: string; reaction: string | null }[];
  conditions: { label: string; names: string[]; since: string | null; verified_by_patient: boolean; sources: Source[] }[];
  medicines: { id: string; brand: string; generic: string | null; dose: string | null; frequency: string | null; prescriber: string | null; since: string | null; recognised: boolean; verified_by_patient: boolean; repeats: number; source: Source }[];
  labs: { code: string; title: string; value: number; display: string; unit: string | null; date: string; previous: { value: number; date: string } | null; range: { low: number | null; high: number | null } | null; out_of_range: boolean; verified_by_patient: boolean; source: Source }[];
  hospitalisations: { date: string; facility: string | null; diagnoses: string[]; source: Source }[];
  warnings: SafetyWarning[];
  recent_tests: RecentTest[];
  documents: BriefDocument[];
};

const KEY_LABS: { code: string; title: string }[] = [
  { code: "HBA1C", title: "HbA1c" },
  { code: "FBS", title: "Fasting glucose" },
  { code: "BP_SYS", title: "Blood pressure" },
  { code: "LDL", title: "LDL cholesterol" },
  { code: "TSH", title: "TSH" },
  { code: "CREAT", title: "Creatinine" },
  { code: "TROPONIN", title: "Troponin" },
];
const CHRONIC = ["diabetes", "hypertension", "thyroid", "asthma", "cardiac"];
const istDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

export async function buildBrief(link: Row<"share_links">, patient: Row<"patients">): Promise<Brief> {
  const db = adminClient();
  const pid = patient.id;
  const [docsRes, medsRes, labsRes, condsRes, allergiesRes, rangesRes, validityRes] = await Promise.all([
    db.from("documents").select("id, type, doc_date, created_at, facility, doctor_name, condition_tags, extraction_status").eq("patient_id", pid).eq("upload_status", "uploaded"),
    db.from("medications").select("*").eq("patient_id", pid).eq("active", true),
    db.from("lab_results").select("*").eq("patient_id", pid),
    db.from("conditions").select("*").eq("patient_id", pid),
    db.from("allergies").select("substance, severity, reaction").eq("patient_id", pid),
    db.from("lab_reference_ranges").select("test_code, low, high"),
    db.from("test_validity").select("test_code, test_name, validity_days, typical_price_inr"),
  ]);
  for (const r of [docsRes, medsRes, labsRes, condsRes, allergiesRes, rangesRes, validityRes]) if (r.error) throw new Error("brief unavailable");

  const scope = scopeFromLink(link);
  const today = todayIST();
  const docDate = (d: { doc_date: string | null; created_at: string }) => d.doc_date ?? istDate(d.created_at);
  const docs = docsRes.data!.filter((d) => d.extraction_status === "completed" && documentInScope({ condition_tags: d.condition_tags, date: docDate(d) }, scope, today));
  const docById = new Map(docs.map((d) => [d.id, d]));
  const source = (documentId: string, quote: string | null): Source => {
    const d = docById.get(documentId)!;
    return { document_id: d.id, type: d.type, date: docDate(d), facility: d.facility, quote };
  };

  const generics = [...new Set(medsRes.data!.flatMap((m) => m.generics))];
  const [classesRes, interactionsRes] = generics.length
    ? await Promise.all([
        db.from("generics").select("generic, drug_class, category").in("generic", generics),
        db.from("drug_interactions").select("generic_a, generic_b, severity").in("generic_a", generics).in("generic_b", generics),
      ])
    : [{ data: [] }, { data: [] }];
  const classes = classesRes.data ?? [];

  const meds = medsRes.data!.filter(
    (m) => docById.has(m.source_document_id) && factInScope({ categories: categoriesFor(m.generics, classes), date: m.start_date }, scope, today),
  ) as (SafetyMed & Row<"medications">)[];
  const labs = labsRes.data!.filter((l) => docById.has(l.source_document_id) && factInScope({ categories: labCategories(l.test_code), date: l.test_date }, scope, today));
  const conds = condsRes.data!.filter((c) => docById.has(c.source_document_id) && factInScope({ categories: c.category ? [c.category] : [], date: c.diagnosed_on }, scope, today));

  const groups = consolidate(meds);
  const warnings = safetyWarnings({
    groups,
    allergies: allergiesRes.data!.map((a, i) => ({ id: `a${i}`, ...a })),
    interactions: (interactionsRes.data ?? []) as { generic_a: string; generic_b: string; severity: "major" | "moderate" | "minor" }[],
    classes,
  });

  // Chronic conditions grouped by category ("T2DM", "Type 2 diabetes mellitus" are one condition).
  const conditions = CHRONIC.flatMap((cat) => {
    const rows = conds.filter((c) => c.category === cat).sort((a, b) => (a.diagnosed_on ?? "").localeCompare(b.diagnosed_on ?? ""));
    if (!rows.length) return [];
    const unique = [...new Set(rows.map((r) => r.name))];
    const best = preferredConditionName(cat, unique);
    const names = [best, ...unique.filter((n) => n !== best)];
    return [{ label: CONDITION_LABELS[cat], names, since: rows[0].diagnosed_on, verified_by_patient: rows.some((r) => r.verified_by_patient), sources: rows.map((r) => source(r.source_document_id, r.source_text)) }];
  });

  const ranges = new Map(rangesRes.data!.map((r) => [r.test_code, r]));
  const latestLabs = KEY_LABS.flatMap(({ code, title }) => {
    const rows = labs.filter((l) => l.test_code === code && l.value_normalised !== null).sort((a, b) => b.test_date.localeCompare(a.test_date) || b.created_at.localeCompare(a.created_at));
    if (!rows.length) return [];
    const [last] = rows;
    const prev = rows.find((r) => r.test_date < last.test_date);
    const dia = code === "BP_SYS" ? labs.find((l) => l.test_code === "BP_DIA" && l.source_document_id === last.source_document_id && l.test_date === last.test_date) : null;
    const ref = ranges.get(code) ?? null;
    const range = code === "BP_SYS" ? null : ref; // a single range line cannot show a two-number reading
    const value = last.value_normalised!;
    return [{
      code,
      title,
      value,
      display: dia ? `${value}/${dia.value_normalised}` : String(value),
      unit: last.unit_normalised,
      date: last.test_date,
      previous: prev ? { value: prev.value_normalised!, date: prev.test_date } : null,
      range: range ? { low: range.low, high: range.high } : null,
      out_of_range: ref ? (ref.low !== null && value < ref.low) || (ref.high !== null && value > ref.high) : false,
      verified_by_patient: last.verified_by_patient,
      source: source(last.source_document_id, last.source_text),
    }];
  });

  const hospitalisations = docs
    .filter((d) => d.type === "discharge_summary")
    .map((d) => ({ date: docDate(d), facility: d.facility, diagnoses: conds.filter((c) => c.source_document_id === d.id).map((c) => c.name), source: source(d.id, null) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    patient: { name: patient.name, age: ageFrom(patient.dob), sex: patient.sex, blood_group: patient.blood_group },
    scope: { description: describeScope(scope), expires_at: link.expires_at },
    allergies: allergiesRes.data!,
    conditions,
    medicines: groups.map((g) => ({
      id: g.current.id,
      brand: g.current.brand_name,
      generic: g.current.generic_name,
      dose: g.current.dose,
      frequency: decodeFrequency(g.current.frequency) ?? g.current.frequency,
      prescriber: g.current.prescriber,
      since: g.current.start_date,
      recognised: g.current.recognised,
      verified_by_patient: g.current.verified_by_patient,
      repeats: g.history.length,
      source: source(g.current.source_document_id, (g.current as Row<"medications">).source_text),
    })),
    labs: latestLabs,
    hospitalisations,
    warnings,
    recent_tests: recentTests(labs, validityRes.data!, today),
    documents: docs
      .map((d) => ({ id: d.id, type: d.type, type_label: DOC_TYPE_LABELS[d.type as keyof typeof DOC_TYPE_LABELS] ?? "Record", date: docDate(d), facility: d.facility, doctor: d.doctor_name }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Is this document visible through this link? Used by the file route; out-of-scope IDs get 403. */
export async function documentAllowed(link: Row<"share_links">, documentId: string) {
  const { data: d } = await adminClient()
    .from("documents")
    .select("id, patient_id, storage_path, mime_type, doc_date, created_at, condition_tags, upload_status, extraction_status")
    .eq("id", documentId)
    .maybeSingle();
  if (!d || d.patient_id !== link.patient_id || d.upload_status !== "uploaded" || d.extraction_status !== "completed") return null;
  const inScope = documentInScope({ condition_tags: d.condition_tags, date: d.doc_date ?? istDate(d.created_at) }, scopeFromLink(link), todayIST());
  return inScope ? d : null;
}
