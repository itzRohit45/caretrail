import { describe, expect, it } from "vitest";
import { consolidate, courseEnded, safetyWarnings, type SafetyMed } from "../engine";

let n = 0;
const med = (p: Partial<SafetyMed>): SafetyMed => ({
  id: `m${++n}`, brand_name: "X", generic_name: null, generics: [], recognised: true, prescriber: null,
  start_date: "2026-08-20", duration_days: null, dose: null, frequency: null, source_document_id: "d1", verified_by_patient: false, ...p,
});
const classes = [
  { generic: "metformin", drug_class: "biguanides" },
  { generic: "amoxicillin", drug_class: "penicillins" },
  { generic: "telmisartan", drug_class: "angiotensin receptor blockers" },
  { generic: "aspirin", drug_class: "nsaids" },
  { generic: "sulfamethoxazole", drug_class: "sulfonamides" },
];

describe("consolidate", () => {
  it("treats repeat prescriptions of a brand as one medicine, newest current", () => {
    const g = consolidate([
      med({ brand_name: "Tab. Glycomet 500 mg", generics: ["metformin"], start_date: "2025-11-12", prescriber: "Dr. A. Suresh" }),
      med({ brand_name: "Glycomet 500", generics: ["metformin"], start_date: "2026-08-20", prescriber: "Dr. A. Suresh" }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].current.start_date).toBe("2026-08-20");
    expect(g[0].history).toHaveLength(1);
  });
});

describe("safetyWarnings", () => {
  it("flags the same generic under two brands from two doctors, naming both", () => {
    const groups = consolidate([
      med({ brand_name: "Glycomet 500", generics: ["metformin"], prescriber: "Dr. A. Suresh" }),
      med({ brand_name: "Gluconorm 500", generics: ["metformin"], prescriber: "Dr. K. Ramesh" }),
    ]);
    const w = safetyWarnings({ groups, allergies: [], interactions: [], classes });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: "duplicate", level: "caution", title: "Metformin prescribed twice" });
    expect(w[0].detail).toContain("Dr. A. Suresh");
    expect(w[0].detail).toContain("Dr. K. Ramesh");
  });

  it("does not flag a brand re-prescribed by the same doctor", () => {
    const groups = consolidate([
      med({ brand_name: "Glycomet 500", generics: ["metformin"], prescriber: "Dr. A. Suresh", start_date: "2025-11-12" }),
      med({ brand_name: "Glycomet 500", generics: ["metformin"], prescriber: "Dr. A. Suresh" }),
    ]);
    expect(safetyWarnings({ groups, allergies: [], interactions: [], classes })).toHaveLength(0);
  });

  it("raises a severe allergy conflict through the drug class", () => {
    const groups = consolidate([med({ brand_name: "Mox 500", generics: ["amoxicillin"], prescriber: "Dr. S. Lakshmanan" })]);
    const w = safetyWarnings({ groups, allergies: [{ id: "a1", substance: "Penicillin", severity: "severe" }], interactions: [], classes });
    expect(w[0]).toMatchObject({ kind: "allergy", level: "severe" });
    expect(w[0].detail).toContain("penicillins");
  });

  it("matches common allergy wording such as sulfa drugs", () => {
    const groups = consolidate([med({ brand_name: "Septran", generics: ["sulfamethoxazole"] })]);
    const w = safetyWarnings({ groups, allergies: [{ id: "a2", substance: "Sulfa drugs", severity: "moderate" }], interactions: [], classes });
    expect(w).toHaveLength(1);
  });

  it("reports interactions with severity and skips unrecognised medicines", () => {
    const groups = consolidate([
      med({ brand_name: "Telma 40", generics: ["telmisartan"], prescriber: "Dr. A. Suresh" }),
      med({ brand_name: "Ecosprin 75", generics: ["aspirin"], prescriber: "Dr. K. Ramesh" }),
      med({ brand_name: "Zyxolin", generics: [], recognised: false }),
    ]);
    const w = safetyWarnings({ groups, allergies: [], interactions: [{ generic_a: "aspirin", generic_b: "telmisartan", severity: "moderate" }], classes });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: "interaction", level: "caution", severity: "moderate" });
  });

  it("orders severe before caution before info", () => {
    const groups = consolidate([
      med({ brand_name: "A", generics: ["aspirin"] }),
      med({ brand_name: "B", generics: ["telmisartan"] }),
      med({ brand_name: "Mox", generics: ["amoxicillin"] }),
    ]);
    const w = safetyWarnings({
      groups,
      allergies: [{ id: "a1", substance: "penicillin", severity: "severe" }],
      interactions: [{ generic_a: "aspirin", generic_b: "telmisartan", severity: "minor" }],
      classes,
    });
    expect(w.map((x) => x.level)).toEqual(["severe", "info"]);
  });
});

describe("courseEnded", () => {
  it("returns the end date once a written duration has passed", () => {
    expect(courseEnded({ start_date: "2026-09-25", duration_days: 5 }, "2026-10-10")).toBe("2026-09-30");
    expect(courseEnded({ start_date: "2026-09-25", duration_days: 30 }, "2026-10-10")).toBeNull();
    expect(courseEnded({ start_date: "2026-09-25", duration_days: null }, "2026-10-10")).toBeNull();
  });
});
