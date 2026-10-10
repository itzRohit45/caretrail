import { describe, expect, it } from "vitest";
import { recentTests, validTestsValue } from "../test-saver";

const validity = [
  { test_code: "HBA1C", test_name: "HbA1c", validity_days: 90, typical_price_inr: 450 },
  { test_code: "LIPID", test_name: "Lipid profile", validity_days: 180, typical_price_inr: 600 },
  { test_code: "FBS", test_name: "Fasting blood glucose", validity_days: 30, typical_price_inr: 80 },
];
const lab = (code: string, date: string) => ({ test_code: code, test_date: date, source_document_id: `doc-${code}-${date}`, facility: "Sri Ram Diagnostics" });

describe("recentTests", () => {
  const today = "2026-10-10";
  const tests = recentTests(
    [lab("HBA1C", "2025-11-08"), lab("HBA1C", "2026-09-19"), lab("LDL", "2026-03-20"), lab("TG", "2026-03-20"), lab("FBS", "2026-09-01")],
    validity,
    today,
  );

  it("uses the latest test per panel and computes next due", () => {
    const hba1c = tests.find((t) => t.code === "HBA1C")!;
    expect(hba1c).toMatchObject({ lastDate: "2026-09-19", daysAgo: 21, nextDue: "2026-12-18", valid: true });
  });
  it("groups lipid components into one panel", () => {
    expect(tests.filter((t) => t.code === "LIPID")).toHaveLength(1);
  });
  it("marks expired windows as due", () => {
    expect(tests.find((t) => t.code === "LIPID")?.valid).toBe(false);
    expect(tests.find((t) => t.code === "FBS")?.valid).toBe(false);
  });
  it("totals only tests still valid", () => {
    expect(validTestsValue(tests)).toBe(450);
  });
});
