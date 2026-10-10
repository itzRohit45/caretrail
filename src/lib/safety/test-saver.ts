// Test Saver: which tests are still within their validity window, and when each is next due.

const PANEL: Record<string, string> = {
  HBA1C: "HBA1C", FBS: "FBS", PPBS: "PPBS",
  LDL: "LIPID", HDL: "LIPID", TC: "LIPID", TG: "LIPID",
  CREAT: "KFT", UREA: "KFT", EGFR: "KFT",
  TSH: "TSH", FT4: "TSH",
  HB: "CBC", TROPONIN: "TROPONIN",
};

export type ValidityRow = { test_code: string; test_name: string; validity_days: number; typical_price_inr: number };
export type LabRow = { test_code: string | null; test_date: string; source_document_id: string; facility: string | null };

export type RecentTest = {
  code: string;
  name: string;
  lastDate: string;
  daysAgo: number;
  nextDue: string;
  valid: boolean;
  price: number;
  documentId: string;
  facility: string | null;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function recentTests(labs: LabRow[], validity: ValidityRow[], today: string): RecentTest[] {
  const latest = new Map<string, LabRow>();
  for (const l of labs) {
    const panel = l.test_code ? PANEL[l.test_code] : undefined;
    if (!panel || l.test_date > today) continue;
    const seen = latest.get(panel);
    if (!seen || l.test_date > seen.test_date) latest.set(panel, l);
  }
  const rules = new Map(validity.map((v) => [v.test_code, v]));
  return [...latest.entries()]
    .flatMap(([panel, l]) => {
      const rule = rules.get(panel);
      if (!rule) return [];
      const nextDue = addDays(l.test_date, rule.validity_days);
      return [{
        code: panel,
        name: rule.test_name,
        lastDate: l.test_date,
        daysAgo: daysBetween(l.test_date, today),
        nextDue,
        valid: nextDue > today,
        price: rule.typical_price_inr,
        documentId: l.source_document_id,
        facility: l.facility,
      }];
    })
    .sort((a, b) => Number(b.valid) - Number(a.valid) || a.nextDue.localeCompare(b.nextDue));
}

/** Typical price of the tests still valid: what repeating them now would cost (an estimate). */
export const validTestsValue = (tests: RecentTest[]) => tests.filter((t) => t.valid).reduce((sum, t) => sum + t.price, 0);
