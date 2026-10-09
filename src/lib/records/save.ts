import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Insert, Row } from "@/lib/db/types";
import type { Extraction } from "@/lib/extraction/schema";
import type { VerifyPayload } from "@/lib/schemas/verify";
import { buildBrandIndex, categoriesFor, matchBrand, type GenericRow } from "@/lib/normalise/brands";
import { LAB_CATEGORY, normaliseValue, parseNumber, parseRange, splitBloodPressure, testCode } from "@/lib/normalise/labs";
import { conditionCategory } from "@/lib/normalise/conditions";
import { toIsoDate } from "@/lib/normalise/dates";

type Db = SupabaseClient<Database>;

export async function loadReference(db: Db) {
  const [brands, generics] = await Promise.all([
    db.from("brand_generic_map").select("brand, generic"),
    db.from("generics").select("generic, drug_class, category"),
  ]);
  if (brands.error || generics.error) throw new Error("reference data unavailable");
  return { index: buildBrandIndex(brands.data, generics.data), generics: generics.data as GenericRow[] };
}

/** A confident extraction becomes a payload directly (nothing for the patient to check). */
export function payloadFromExtraction(x: Extraction): VerifyPayload {
  return {
    doc_date: toIsoDate(x.document_date?.value),
    facility: x.facility?.value ?? null,
    doctor_name: x.doctor_name?.value ?? null,
    medications: x.medications.map((m) => ({
      brand_name: m.brand_name,
      dose: m.strength ?? null,
      frequency: m.frequency ?? null,
      duration_days: m.duration_days ?? null,
      source_text: m.source_text,
      confidence: m.confidence,
      patient_verified: false,
    })),
    lab_results: x.lab_results.map((l) => ({
      test_name: l.test_name,
      value: l.value,
      unit: l.unit ?? null,
      ref_range: l.ref_range ?? null,
      test_date: toIsoDate(l.test_date),
      source_text: l.source_text,
      confidence: l.confidence,
      patient_verified: false,
    })),
    conditions: x.conditions.map((c) => ({ name: c.name, source_text: c.source_text, confidence: c.confidence, patient_verified: false })),
  };
}

const istDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

/**
 * Normalises verified fields and writes them as facts linked to their source document.
 * The caller has already claimed the document (status moved off needs_review) so this runs once.
 */
export async function saveFacts(db: Db, doc: Row<"documents">, payload: VerifyPayload, ref: Awaited<ReturnType<typeof loadReference>>) {
  const extracted = (doc.extraction as Extraction | null)?.document_date?.value;
  const docDate = payload.doc_date ?? istDate(doc.created_at);
  const docDateSource = payload.doc_date ? (toIsoDate(extracted) === payload.doc_date ? "extracted" : "patient") : "upload";
  const base = { patient_id: doc.patient_id, source_document_id: doc.id };
  const tags = new Set<string>();

  const medications: Insert<"medications">[] = payload.medications.map((m) => {
    const match = matchBrand(m.brand_name, ref.index);
    categoriesFor(match.generics, ref.generics).forEach((c) => tags.add(c));
    return {
      ...base,
      brand_name: m.brand_name,
      generic_name: match.generics.length ? match.generics.join(" + ") : null,
      generics: match.generics,
      recognised: match.recognised,
      dose: m.dose,
      frequency: m.frequency,
      duration_days: m.duration_days,
      prescriber: payload.doctor_name,
      start_date: docDate,
      confidence: m.confidence,
      source_text: m.source_text,
      verified_by_patient: m.patient_verified,
    };
  });

  const lab_results: Insert<"lab_results">[] = payload.lab_results.flatMap((l) => {
    const code = testCode(l.test_name);
    const common = {
      ...base,
      test_name: l.test_name,
      value_text: l.value,
      ref_range_text: l.ref_range,
      test_date: l.test_date ?? docDate,
      facility: payload.facility,
      confidence: l.confidence,
      source_text: l.source_text,
      verified_by_patient: l.patient_verified,
    };
    const bp = code === "BP" ? splitBloodPressure(l.value) : null;
    if (bp) {
      tags.add("hypertension");
      return (["BP_SYS", "BP_DIA"] as const).map((c) => {
        const value = c === "BP_SYS" ? bp.systolic : bp.diastolic;
        return { ...common, test_code: c, value, unit: l.unit ?? "mmHg", value_normalised: value, unit_normalised: "mmHg", ref_low: null, ref_high: null };
      });
    }
    const value = parseNumber(l.value);
    const norm = normaliseValue(code, value, l.unit);
    const range = parseRange(l.ref_range);
    if (code && LAB_CATEGORY[code]) tags.add(LAB_CATEGORY[code]);
    return [{ ...common, test_code: code === "BP" ? null : code, value, unit: l.unit, value_normalised: norm.value, unit_normalised: norm.unit, ref_low: range.low, ref_high: range.high }];
  });

  const conditions: Insert<"conditions">[] = payload.conditions.map((c) => {
    const category = conditionCategory(c.name);
    tags.add(category);
    return { ...base, name: c.name, category, diagnosed_on: docDate, confidence: c.confidence, source_text: c.source_text, verified_by_patient: c.patient_verified };
  });

  const results = await Promise.all([
    medications.length ? db.from("medications").insert(medications) : null,
    lab_results.length ? db.from("lab_results").insert(lab_results) : null,
    conditions.length ? db.from("conditions").insert(conditions) : null,
  ]);
  const failed = results.find((r) => r?.error);
  if (failed?.error) throw new Error(`could not save facts: ${failed.error.code}`);

  tags.delete("other");
  const { error } = await db
    .from("documents")
    .update({
      doc_date: docDate,
      doc_date_source: docDateSource,
      facility: payload.facility,
      doctor_name: payload.doctor_name,
      condition_tags: [...tags].sort(),
      extraction_status: "completed",
      verified_at: new Date().toISOString(),
    })
    .eq("id", doc.id);
  if (error) throw new Error(`could not update document: ${error.code}`);
  return { medications: medications.length, lab_results: lab_results.length, conditions: conditions.length };
}
