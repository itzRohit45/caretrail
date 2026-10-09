import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export const TRENDS = [
  { key: "HbA1c", title: "HbA1c", codes: ["HBA1C"], unit: "%" },
  { key: "FBS", title: "Fasting glucose", codes: ["FBS"], unit: "mg/dL" },
  { key: "BP", title: "Blood pressure", codes: ["BP_SYS", "BP_DIA"], unit: "mmHg" },
  { key: "TSH", title: "TSH", codes: ["TSH"], unit: "mIU/L" },
  { key: "LDL", title: "LDL cholesterol", codes: ["LDL"], unit: "mg/dL" },
] as const;
export type TrendKey = (typeof TRENDS)[number]["key"];
export const TREND_KEYS = ["HbA1c", "FBS", "BP", "TSH", "LDL"] as const satisfies readonly TrendKey[];

export type TrendPoint = {
  id: string;
  date: string;
  t: number;
  value: number;
  /** As printed, when the unit was converted for the chart. */
  original: string | null;
  facility: string | null;
  documentId: string;
};
export type BpPoint = { id: string; date: string; t: number; sys: number; dia: number; facility: string | null; documentId: string };
export type Trend =
  | { key: Exclude<TrendKey, "BP">; title: string; unit: string; points: TrendPoint[]; range: { low: number | null; high: number | null } | null }
  | { key: "BP"; title: string; unit: string; points: BpPoint[]; range: null };

const ts = (d: string) => Date.parse(`${d}T00:00:00+05:30`);

/** Chart series from stored lab rows only. Two labs on the same day stay as two points. */
export async function loadTrends(db: SupabaseClient<Database>, patientId: string, only?: TrendKey): Promise<Trend[]> {
  const wanted = TRENDS.filter((t) => !only || t.key === only);
  const codes = wanted.flatMap((t) => [...t.codes]);
  const [labs, ranges] = await Promise.all([
    db
      .from("lab_results")
      .select("id, test_code, value, value_text, unit, value_normalised, unit_normalised, test_date, facility, source_document_id")
      .eq("patient_id", patientId)
      .in("test_code", codes)
      .not("value_normalised", "is", null)
      .order("test_date", { ascending: true }),
    db.from("lab_reference_ranges").select("test_code, low, high").in("test_code", codes),
  ]);
  if (labs.error || ranges.error) throw new Error("trends unavailable");

  return wanted.map((def): Trend => {
    if (def.key === "BP") {
      const byDoc = new Map<string, BpPoint>();
      for (const r of labs.data.filter((l) => l.test_code === "BP_SYS" || l.test_code === "BP_DIA")) {
        const k = `${r.source_document_id}:${r.test_date}`;
        const p = byDoc.get(k) ?? { id: r.id, date: r.test_date, t: ts(r.test_date), sys: NaN, dia: NaN, facility: r.facility, documentId: r.source_document_id };
        if (r.test_code === "BP_SYS") p.sys = r.value_normalised!;
        else p.dia = r.value_normalised!;
        byDoc.set(k, p);
      }
      const points = [...byDoc.values()].filter((p) => Number.isFinite(p.sys) && Number.isFinite(p.dia)).sort((a, b) => a.t - b.t);
      return { key: "BP", title: def.title, unit: def.unit, points, range: null };
    }
    const range = ranges.data.find((r) => r.test_code === def.codes[0]) ?? null;
    const points = labs.data
      .filter((l) => l.test_code === def.codes[0])
      .map((l) => ({
        id: l.id,
        date: l.test_date,
        t: ts(l.test_date),
        value: l.value_normalised!,
        original: l.unit && l.unit_normalised && l.unit.replace(/\s/g, "").toLowerCase() !== l.unit_normalised.replace(/\s/g, "").toLowerCase() ? `${l.value_text} ${l.unit}` : null,
        facility: l.facility,
        documentId: l.source_document_id,
      }));
    return { key: def.key, title: def.title, unit: def.unit, points, range: range ? { low: range.low, high: range.high } : null };
  });
}
