import { cleanBrand } from "@/lib/normalise/brands";

// Cross-prescriber safety checks. Pure functions over stored rows, so the patient app, the doctor
// brief and the tests all get the same answer.

export type SafetyMed = {
  id: string;
  brand_name: string;
  generic_name: string | null;
  generics: string[];
  recognised: boolean;
  prescriber: string | null;
  start_date: string | null;
  duration_days: number | null;
  dose: string | null;
  frequency: string | null;
  source_document_id: string;
  verified_by_patient: boolean;
};
export type SafetyAllergy = { id: string; substance: string; severity: string };
export type SafetyInteraction = { generic_a: string; generic_b: string; severity: "major" | "moderate" | "minor" };
export type GenericClass = { generic: string; drug_class: string | null };

/** Repeat prescriptions of the same brand are one medicine; the newest entry is current. */
export type MedGroup = { key: string; current: SafetyMed; history: SafetyMed[]; ids: string[] };

export function consolidate(meds: SafetyMed[]): MedGroup[] {
  const groups = new Map<string, SafetyMed[]>();
  for (const m of meds) {
    const key = cleanBrand(m.brand_name).toLowerCase().replace(/[^a-z0-9]+/g, "") || m.id;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
      return { key, current: sorted[0], history: sorted.slice(1), ids: sorted.map((m) => m.id) };
    })
    .sort((a, b) => a.current.brand_name.localeCompare(b.current.brand_name));
}

export type WarningItem = { medicationId: string; brand: string; generic: string | null; prescriber: string | null; documentId: string };
export type SafetyWarning = {
  id: string;
  kind: "allergy" | "interaction" | "duplicate";
  /** severe: allergy clash or major interaction (red). caution: duplicate or moderate. info: minor. */
  level: "severe" | "caution" | "info";
  severity?: SafetyInteraction["severity"];
  title: string;
  detail: string;
  items: WarningItem[];
};

export const SAFETY_NOTE = "Discuss with your doctor; do not stop medicines on your own.";

const ALLERGY_ALIASES: Record<string, string> = { sulfa: "sulfonamides", sulpha: "sulfonamides", sulphonamides: "sulfonamides", nsaid: "nsaids", penicilin: "penicillins" };
function allergyTerms(substance: string) {
  const s = substance.toLowerCase().replace(/\b(allergy|allergic|drugs?|medicines?|group|class)\b/g, "").replace(/[^a-z0-9 -]+/g, " ").trim();
  const base = ALLERGY_ALIASES[s] ?? s;
  return new Set([base, base.replace(/s$/, ""), `${base.replace(/s$/, "")}s`]);
}

const item = (m: SafetyMed): WarningItem => ({ medicationId: m.id, brand: m.brand_name, generic: m.generic_name, prescriber: m.prescriber, documentId: m.source_document_id });
const by = (m: SafetyMed) => (m.prescriber ? `${m.brand_name} (${m.prescriber})` : m.brand_name);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function safetyWarnings(input: { groups: MedGroup[]; allergies: SafetyAllergy[]; interactions: SafetyInteraction[]; classes: GenericClass[] }) {
  const { groups, allergies, interactions, classes } = input;
  const classOf = new Map(classes.map((c) => [c.generic, c.drug_class?.toLowerCase() ?? null]));
  const warnings: SafetyWarning[] = [];
  const current = groups.map((g) => g.current);

  // 1. Allergy conflicts: a medicine (or its class) matching a recorded allergy. Always severe.
  for (const a of allergies) {
    const terms = allergyTerms(a.substance);
    for (const m of current) {
      const hit = m.generics.find((g) => terms.has(g) || (classOf.get(g) && terms.has(classOf.get(g)!)));
      if (!hit) continue;
      const viaClass = !terms.has(hit);
      warnings.push({
        id: `allergy:${a.id}:${m.id}`,
        kind: "allergy",
        level: "severe",
        title: `${m.brand_name} may clash with your ${a.substance} allergy`,
        detail: `${m.brand_name} contains ${hit}${viaClass ? `, which belongs to the ${classOf.get(hit)} group` : ""}. Prescribed by ${m.prescriber ?? "a doctor"}. Your allergy is recorded as ${a.severity}.`,
        items: [item(m)],
      });
    }
  }

  // 2. Duplicate therapy: the same generic in different medicines from different prescribers.
  const byGeneric = new Map<string, SafetyMed[]>();
  for (const m of current) for (const g of m.generics) byGeneric.set(g, [...(byGeneric.get(g) ?? []), m]);
  for (const [generic, meds] of byGeneric) {
    const prescribers = new Set(meds.map((m) => m.prescriber ?? "unknown"));
    if (meds.length < 2 || prescribers.size < 2) continue;
    warnings.push({
      id: `duplicate:${generic}`,
      kind: "duplicate",
      level: "caution",
      title: `${cap(generic)} prescribed ${meds.length === 2 ? "twice" : `${meds.length} times`}`,
      detail: `${meds.map(by).join(" and ")} ${meds.length === 2 ? "both contain" : "all contain"} ${generic}. Taking them together may mean a double dose.`,
      items: meds.map(item),
    });
  }

  // 3. Interactions: one warning per pair of medicines, at the most severe level among their ingredients
  //    (a combination such as budesonide + formoterol can interact through more than one ingredient).
  const pairIndex = new Map(interactions.map((i) => [`${i.generic_a}|${i.generic_b}`, i.severity]));
  const severityRank = { major: 3, moderate: 2, minor: 1 } as const;
  const recognised = current.filter((m) => m.recognised);
  for (let i = 0; i < recognised.length; i++) {
    for (let j = i + 1; j < recognised.length; j++) {
      const a = recognised[i];
      const b = recognised[j];
      const hits: { x: string; y: string; severity: SafetyInteraction["severity"] }[] = [];
      for (const ga of a.generics) {
        for (const gb of b.generics) {
          if (ga === gb) continue;
          const [x, y] = [ga, gb].sort();
          const severity = pairIndex.get(`${x}|${y}`);
          if (severity) hits.push({ x, y, severity });
        }
      }
      if (!hits.length) continue;
      const worst = hits.reduce((w, h) => (severityRank[h.severity] > severityRank[w.severity] ? h : w));
      const severity = worst.severity;
      const pairs = hits.map((h) => `${h.x} and ${h.y} (${h.severity})`).join("; ");
      warnings.push({
        id: `interaction:${[a.id, b.id].sort().join("|")}`,
        kind: "interaction",
        level: severity === "major" ? "severe" : severity === "moderate" ? "caution" : "info",
        severity,
        title: `${cap(severity)} interaction: ${a.brand_name} and ${b.brand_name}`,
        detail: `${hits.length === 1 ? `${cap(worst.x)} and ${worst.y} are listed as a ${severity} interaction.` : `Listed interactions: ${pairs}.`} ${by(a)}; ${by(b)}.`,
        items: [item(a), item(b)],
      });
    }
  }

  const rank = { severe: 0, caution: 1, info: 2 } as const;
  const kindRank = { allergy: 0, interaction: 1, duplicate: 2 } as const;
  return warnings.sort((p, q) => rank[p.level] - rank[q.level] || kindRank[p.kind] - kindRank[q.kind] || p.title.localeCompare(q.title));
}

/** A course whose written duration has passed: prompt to mark it stopped, never remove it. */
export function courseEnded(m: Pick<SafetyMed, "start_date" | "duration_days">, today: string) {
  if (!m.start_date || !m.duration_days) return null;
  const end = new Date(`${m.start_date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + m.duration_days);
  const iso = end.toISOString().slice(0, 10);
  return iso < today ? iso : null;
}
