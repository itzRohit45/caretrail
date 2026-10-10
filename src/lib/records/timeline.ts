import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Row } from "@/lib/db/types";
import { DOC_TYPES } from "@/lib/schemas/documents";

export const CONDITION_FILTERS = ["diabetes", "hypertension", "thyroid", "asthma", "cardiac"] as const;
export const RANGE_FILTERS = ["3", "6", "12"] as const;

const blank = (v: unknown) => (v === "" || v === "all" ? undefined : v);
export const timelineFilterSchema = z.object({
  condition: z.preprocess(blank, z.enum(CONDITION_FILTERS).optional()),
  type: z.preprocess(blank, z.enum(DOC_TYPES).optional()),
  months: z.preprocess(blank, z.enum(RANGE_FILTERS).optional()),
  from: z.preprocess(blank, z.iso.date().optional()),
  to: z.preprocess(blank, z.iso.date().optional()),
});
export type TimelineFilters = z.infer<typeof timelineFilterSchema>;

export type TimelineEntry = Pick<Row<"documents">, "id" | "type" | "doc_date" | "doc_date_source" | "created_at" | "facility" | "doctor_name" | "extraction_status" | "condition_tags" | "uploaded_by"> & {
  date: string;
  medications: Pick<Row<"medications">, "brand_name" | "dose">[];
  labs: Pick<Row<"lab_results">, "test_name" | "value" | "value_text" | "unit" | "test_code">[];
  conditions: Pick<Row<"conditions">, "name">[];
};

const istDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

function monthsAgo(n: number, today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - n, d));
  return dt.toISOString().slice(0, 10);
}

/** All of a patient's documents, newest first, each with a short summary of what it added. */
export async function loadTimeline(db: SupabaseClient<Database>, patientId: string, filters: TimelineFilters) {
  const [docs, meds, labs, conds] = await Promise.all([
    db
      .from("documents")
      .select("id, type, doc_date, doc_date_source, created_at, facility, doctor_name, extraction_status, condition_tags, uploaded_by")
      .eq("patient_id", patientId)
      .eq("upload_status", "uploaded"),
    db.from("medications").select("source_document_id, brand_name, dose").eq("patient_id", patientId),
    db.from("lab_results").select("source_document_id, test_name, value, value_text, unit, test_code").eq("patient_id", patientId),
    db.from("conditions").select("source_document_id, name").eq("patient_id", patientId),
  ]);
  if (docs.error || meds.error || labs.error || conds.error) throw new Error("timeline unavailable");

  const group = <T extends { source_document_id: string }>(rows: T[]) => {
    const map = new Map<string, Omit<T, "source_document_id">[]>();
    for (const { source_document_id, ...rest } of rows) map.set(source_document_id, [...(map.get(source_document_id) ?? []), rest]);
    return map;
  };
  const byMed = group(meds.data);
  const byLab = group(labs.data);
  const byCond = group(conds.data);

  const today = istDate(new Date().toISOString());
  const from = filters.months ? monthsAgo(Number(filters.months), today) : filters.from;
  const all: TimelineEntry[] = docs.data.map((d) => ({
    ...d,
    date: d.doc_date ?? istDate(d.created_at),
    medications: byMed.get(d.id) ?? [],
    labs: byLab.get(d.id) ?? [],
    conditions: byCond.get(d.id) ?? [],
  }));
  const entries = all
    .filter((e) => (filters.condition ? e.condition_tags.includes(filters.condition) : true))
    .filter((e) => (filters.type ? e.type === filters.type : true))
    .filter((e) => (from ? e.date >= from : true))
    .filter((e) => (filters.to ? e.date <= filters.to : true))
    .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)));
  return { entries, total: all.length };
}
