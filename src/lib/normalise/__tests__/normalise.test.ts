import { describe, expect, it } from "vitest";
import { buildBrandIndex, cleanBrand, matchBrand } from "../brands";
import { daysFromQuantity, decodeFrequency, dosesPerDay, readDosing } from "../frequency";
import { normaliseValue, parseRange, splitBloodPressure, testCode, parseNumber } from "../labs";
import { conditionCategory, preferredConditionName } from "../conditions";
import { toIsoDate } from "../dates";

const index = buildBrandIndex(
  [
    { brand: "Glycomet", generic: "metformin" },
    { brand: "Glycomet GP", generic: "metformin" },
    { brand: "Glycomet GP", generic: "glimepiride" },
    { brand: "Gluconorm", generic: "metformin" },
    { brand: "Mox", generic: "amoxicillin" },
    { brand: "Met XL", generic: "metoprolol" },
  ],
  [
    { generic: "metformin", drug_class: "biguanides", category: "diabetes" },
    { generic: "glimepiride", drug_class: "sulfonylureas", category: "diabetes" },
    { generic: "amoxicillin", drug_class: "penicillins", category: "other" },
    { generic: "metoprolol", drug_class: "beta blockers", category: "cardiac" },
  ],
);

describe("brands", () => {
  it("strips form and strength", () => expect(cleanBrand("Tab. Glycomet 500 mg")).toBe("Glycomet"));
  it("maps brands, combos and suffixes", () => {
    expect(matchBrand("Tab Glycomet 500", index)).toEqual({ generics: ["metformin"], recognised: true });
    expect(matchBrand("Glycomet-GP 1", index)).toEqual({ generics: ["glimepiride", "metformin"], recognised: true });
    expect(matchBrand("Glycomet SR 500", index).generics).toEqual(["metformin"]);
    expect(matchBrand("Cap. Mox 500", index).generics).toEqual(["amoxicillin"]);
    expect(matchBrand("Met XL 25", index).generics).toEqual(["metoprolol"]);
  });
  it("maps generic names and written combinations", () => {
    expect(matchBrand("Metformin Hydrochloride 500mg", index).generics).toEqual(["metformin"]);
    expect(matchBrand("Metformin + Glimepiride", index).generics).toEqual(["glimepiride", "metformin"]);
  });
  it("flags unknown brands instead of guessing", () => expect(matchBrand("Zyxolin 10", index)).toEqual({ generics: [], recognised: false }));
});

describe("frequency shorthand", () => {
  it("decodes dose patterns", () => {
    expect(decodeFrequency("1-0-1")).toBe("Morning and night");
    expect(decodeFrequency("0-0-1")).toBe("Night");
    expect(decodeFrequency("1-1-1 after food")).toBe("Morning, afternoon and night, after food");
    expect(decodeFrequency("2-0-2")).toBe("2 in the morning and 2 in the night");
  });
  it("decodes Latin abbreviations", () => {
    expect(decodeFrequency("BD PC")).toBe("Twice daily, after food");
    expect(decodeFrequency("OD AC")).toBe("Once daily, before food");
    expect(decodeFrequency("SOS")).toBe("Only when needed");
    expect(decodeFrequency("HS")).toBe("At bedtime");
  });
  it("returns null for unknown text", () => expect(decodeFrequency("as directed")).toBeNull());
  it("decodes spaced and packed digit patterns from handwritten prescriptions", () => {
    expect(decodeFrequency("1 0 1")).toBe("Morning and night");
    expect(decodeFrequency("0 0 1")).toBe("Night");
    expect(decodeFrequency("001")).toBe("Night");
    expect(decodeFrequency("o o 1")).toBe("Night");
    expect(decodeFrequency("1-1-1")).toBe("Morning, afternoon and night");
  });
  it("does not read a strength as a pattern", () => {
    expect(decodeFrequency("500 mg")).toBeNull();
    expect(decodeFrequency("650")).toBeNull();
    expect(decodeFrequency("200 mg")).toBeNull();
  });
});

describe("dosing read from the written line when the fields are empty", () => {
  it("takes pattern and quantity from the verbatim line, not the strength", () => {
    expect(readDosing({ brand_name: "AZILIFT", source_text: "T. AZILIFT 500mg 001 = 5" })).toEqual({ frequency: "0-0-1", quantity: 5, duration_days: 5, daysFromQuantity: true });
    expect(readDosing({ brand_name: "PANTOCID", source_text: "T. PANTOCID 40mg 101 = 20" })).toMatchObject({ frequency: "1-0-1", quantity: 20, duration_days: 10 });
    expect(readDosing({ brand_name: "DOLO", source_text: "T. DOLO - 650mg 1-1-1 = 30" })).toMatchObject({ frequency: "1-1-1", duration_days: 10 });
  });
  it("keeps what the model filled in, and never turns a bottle into days", () => {
    expect(readDosing({ brand_name: "Glycomet", frequency: "1-0-1", duration_days: 90, source_text: "Tab. Glycomet 500 mg 1-0-1 x 90 days" })).toMatchObject({ frequency: "1-0-1", duration_days: 90, daysFromQuantity: false });
    expect(readDosing({ brand_name: "BROCHOREX COUGH SYRUP", source_text: "BROCHOREX COUGH SYRUP 10ml HS = (1) Bottle" })).toMatchObject({ frequency: "HS", duration_days: null });
  });
});

describe("course length from quantity", () => {
  it("counts doses a day", () => {
    expect(dosesPerDay("1 0 1")).toBe(2);
    expect(dosesPerDay("001")).toBe(1);
    expect(dosesPerDay("1-1-1")).toBe(3);
    expect(dosesPerDay("BD")).toBe(2);
    expect(dosesPerDay("SOS")).toBeNull();
  });
  it("turns tablets into days only when it divides exactly", () => {
    expect(daysFromQuantity(20, "1 0 1")).toBe(10);
    expect(daysFromQuantity(5, "0 0 1")).toBe(5);
    expect(daysFromQuantity(30, "1-1-1")).toBe(10);
    expect(daysFromQuantity(15, "1-0-1")).toBeNull();
    expect(daysFromQuantity(10, "SOS")).toBeNull();
    expect(daysFromQuantity(undefined, "1-0-1")).toBeNull();
    expect(daysFromQuantity(1, "HS", "BROCHOREX COUGH SYRUP 10ml HS = 1 bottle")).toBeNull();
  });
});

describe("labs", () => {
  it("recognises test names", () => {
    expect(testCode("Glycosylated Haemoglobin (HbA1c)")).toBe("HBA1C");
    expect(testCode("Fasting Blood Sugar")).toBe("FBS");
    expect(testCode("LDL Cholesterol - Direct")).toBe("LDL");
    expect(testCode("TSH (Ultrasensitive)")).toBe("TSH");
    expect(testCode("Vitamin K")).toBeNull();
  });
  it("converts units and never guesses unknown ones", () => {
    expect(normaliseValue("FBS", 7, "mmol/L")).toEqual({ value: 126, unit: "mg/dL" });
    expect(normaliseValue("FBS", 126, "mg/dl")).toEqual({ value: 126, unit: "mg/dL" });
    expect(normaliseValue("TSH", 2.5, "µIU/mL")).toEqual({ value: 2.5, unit: "mIU/L" });
    expect(normaliseValue("HBA1C", 53, "mmol/mol").value).toBeCloseTo(7.0, 1);
    expect(normaliseValue("FBS", 126, "furlongs")).toEqual({ value: null, unit: null });
  });
  it("parses ranges and numbers", () => {
    expect(parseRange("4.0 - 5.6")).toEqual({ low: 4, high: 5.6 });
    expect(parseRange("< 200 mg/dL")).toEqual({ low: null, high: 200 });
    expect(parseRange(">40")).toEqual({ low: 40, high: null });
    expect(parseNumber("7.2")).toBe(7.2);
    expect(parseNumber("7.4 H")).toBe(7.4);
    expect(parseNumber("39 L")).toBe(39);
    expect(parseNumber("<0.01")).toBeNull();
    expect(splitBloodPressure("142/90 mmHg")).toEqual({ systolic: 142, diastolic: 90 });
  });
});

describe("conditions and dates", () => {
  it("categorises conditions", () => {
    expect(conditionCategory("K/c/o T2DM")).toBe("diabetes");
    expect(conditionCategory("Systemic hypertension")).toBe("hypertension");
    expect(conditionCategory("NSTEMI s/p PCI to LAD")).toBe("cardiac");
    expect(conditionCategory("Bronchial asthma")).toBe("asthma");
    expect(conditionCategory("Fracture")).toBe("other");
  });
  it("names a chronic condition by its diagnosis, not an episode", () => {
    expect(preferredConditionName("diabetes", ["Hypoglycaemia secondary to poor oral intake", "Type 2 diabetes mellitus", "T2DM"])).toBe("Type 2 diabetes mellitus");
    expect(preferredConditionName("cardiac", ["Acute NSTEMI", "Coronary artery disease, single vessel (LAD)"])).toBe("Coronary artery disease, single vessel (LAD)");
  });
  it("parses written dates and rejects future or impossible ones", () => {
    expect(toIsoDate("14/08/2026", "2026-10-10")).toBe("2026-08-14");
    expect(toIsoDate("2026-08-14", "2026-10-10")).toBe("2026-08-14");
    expect(toIsoDate("14 Aug 2026", "2026-10-10")).toBe("2026-08-14");
    expect(toIsoDate("31/02/2026", "2026-10-10")).toBeNull();
    expect(toIsoDate("14/12/2026", "2026-10-10")).toBeNull();
  });
});
