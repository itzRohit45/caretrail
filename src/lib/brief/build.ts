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
  since_last_visit: SinceLastVisit | null;
};

/** FR-13: what is dated after this doctor's previous view (same name and registration number). */
export type SinceLastVisit = {
  at: string;
  warnings: SafetyWarning[];
  started: { brand: string; generic: string | null; detail: string; prescriber: string | null; date: string; source: Source }[];
  changed: { brand: string; from: string; to: string; prescriber: string | null; date: string; source: Source }[];
  stopped: { brand: string; generic: string | null; stopped_on: string; source: Source }[];
  labs: { code: string; title: string; display: string; unit: string | null; date: string; previous: { display: string; date: string } | null; out_of_range: boolean; source: Source }[];
  diagnoses: { name: string; date: string; source: Source }[];
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

export async function buildBrief(link: Row<"share_links">, patient: Row<"patients">, previousVisitAt: string | null = null): Promise<Brief> {
  const db = adminClient();
  const pid = patient.id;
  const [docsRes, medsRes, labsRes, condsRes, allergiesRes, rangesRes, validityRes] = await Promise.all([
    db.from("documents").select("id, type, doc_date, created_at, facility, doctor_name, condition_tags, extraction_status").eq("patient_id", pid).eq("upload_status", "uploaded"),
    db.from("medications").select("*").eq("patient_id", pid),
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

  const medsInScope = medsRes.data!.filter(
    (m) => docById.has(m.source_document_id) && factInScope({ categories: categoriesFor(m.generics, classes), date: m.start_date }, scope, today),
  ) as (SafetyMed & Row<"medications">)[];
  const meds = medsInScope.filter((m) => m.active);
  const labs = labsRes.data!.filter((l) => docById.has(l.source_document_id) && factInScope({ categories: labCategories(l.test_code), date: l.test_date }, scope, today));
  const conds = condsRes.data!.filter((c) => docById.has(c.source_document_id) && factInScope({ categories: c.category ? [c.category] : [], date: c.diagnosed_on }, scope, today));

  const groups = consolidate(meds);
  const warnings = safetyWarnings({
    groups,
    allergies: allergiesRes.data!.map((a, i) => ({ id: `a${i}`, ...a })),
    interactions: (interactionsRes.data ?? []) as { generic_a: string; generic_b: string; severity: "major" | "moderate" | "minor" }[],
    classes,
    audience: "doctor",
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

  const briefDoc = (d: (typeof docs)[number]): BriefDocument => ({ id: d.id, type: d.type, type_label: DOC_TYPE_LABELS[d.type as keyof typeof DOC_TYPE_LABELS] ?? "Record", date: docDate(d), facility: d.facility, doctor: d.doctor_name });

  let since_last_visit: SinceLastVisit | null = null;
  if (previousVisitAt) {
    // Clinical dates (document, test, start, stop), compared with the day of the previous view.
    const since = istDate(previousVisitAt);
    const isNew = (date: string | null) => date !== null && date > since;
    const dateOfDoc = (id: string) => docDate(docById.get(id)!);
    const medDate = (m: SafetyMed) => m.start_date ?? dateOfDoc(m.source_document_id);
    const medDetail = (m: SafetyMed) => [m.dose, decodeFrequency(m.frequency) ?? m.frequency].filter(Boolean).join(", ");
    const medSource = (m: SafetyMed) => source(m.source_document_id, (m as Row<"medications">).source_text);

    const started: SinceLastVisit["started"] = [];
    const changed: SinceLastVisit["changed"] = [];
    for (const g of groups) {
      if (!isNew(medDate(g.current))) continue;
      const before = g.history.find((h) => !isNew(medDate(h)));
      if (!before) {
        started.push({ brand: g.current.brand_name, generic: g.current.generic_name, detail: medDetail(g.current), prescriber: g.current.prescriber, date: medDate(g.current), source: medSource(g.current) });
      } else if (medDetail(before) !== medDetail(g.current)) {
        changed.push({ brand: g.current.brand_name, from: medDetail(before) || "not written", to: medDetail(g.current) || "not written", prescriber: g.current.prescriber, date: medDate(g.current), source: medSource(g.current) });
      }
    }
    const stopped = medsInScope
      .filter((m) => !m.active && isNew(m.stopped_on))
      .map((m) => ({ brand: m.brand_name, generic: m.generic_name, stopped_on: m.stopped_on!, source: medSource(m) }));

    const titles = new Map(KEY_LABS.map((k) => [k.code, k.title]));
    const byDateDesc = (a: Row<"lab_results">, b: Row<"lab_results">) => b.test_date.localeCompare(a.test_date) || b.created_at.localeCompare(a.created_at);
    const showLab = (l: Row<"lab_results">) => {
      const dia = l.test_code === "BP_SYS" ? labs.find((x) => x.test_code === "BP_DIA" && x.source_document_id === l.source_document_id && x.test_date === l.test_date) : null;
      return dia ? `${l.value_normalised ?? l.value}/${dia.value_normalised ?? dia.value}` : String(l.value_normalised ?? l.value ?? l.value_text ?? "");
    };
    const newLabCodes = [...new Set(labs.filter((l) => isNew(l.test_date) && l.test_code !== "BP_DIA").map((l) => l.test_code ?? l.test_name))];
    const sinceLabs = newLabCodes
      .map((code) => {
        const rows = labs.filter((l) => (l.test_code ?? l.test_name) === code).sort(byDateDesc);
        const last = rows[0];
        const prev = rows.find((r) => !isNew(r.test_date));
        const ref = last.test_code && last.test_code !== "BP_SYS" ? ranges.get(last.test_code) : null;
        const v = last.value_normalised;
        return {
          code,
          title: (last.test_code && titles.get(last.test_code)) ?? last.test_name,
          display: showLab(last),
          unit: last.unit_normalised ?? last.unit,
          date: last.test_date,
          previous: prev ? { display: showLab(prev), date: prev.test_date } : null,
          out_of_range: ref && v !== null ? (ref.low !== null && v < ref.low) || (ref.high !== null && v > ref.high) : false,
          source: source(last.source_document_id, last.source_text),
        };
      })
      .sort((a, b) => Number(titles.has(b.code)) - Number(titles.has(a.code)) || b.date.localeCompare(a.date));

    const condDate = (c: Row<"conditions">) => c.diagnosed_on ?? dateOfDoc(c.source_document_id);
    const knownBefore = new Set(conds.filter((c) => !isNew(condDate(c))).map((c) => c.category ?? c.name.toLowerCase()));
    const seenNames = new Set<string>();
    const diagnoses = conds
      .filter((c) => isNew(condDate(c)) && !knownBefore.has(c.category ?? c.name.toLowerCase()))
      .sort((a, b) => condDate(b).localeCompare(condDate(a)))
      .filter((c) => !seenNames.has(c.name.toLowerCase()) && Boolean(seenNames.add(c.name.toLowerCase())))
      .map((c) => ({ name: c.name, date: condDate(c), source: source(c.source_document_id, c.source_text) }));

    since_last_visit = {
      at: previousVisitAt,
      warnings: warnings.filter((w) => w.level !== "info" && w.items.some((i) => docById.has(i.documentId) && isNew(dateOfDoc(i.documentId)))),
      started,
      changed,
      stopped,
      labs: sinceLabs,
      diagnoses,
      documents: docs.filter((d) => isNew(docDate(d))).map(briefDoc).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

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
    documents: docs.map(briefDoc).sort((a, b) => b.date.localeCompare(a.date)),
    since_last_visit,
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
