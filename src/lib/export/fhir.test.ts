import { describe, expect, it } from "vitest";
import { buildFhirBundle, type FhirInput } from "./fhir";

const P = "11111111-1111-4111-8111-111111111111";
const D = "22222222-2222-4222-8222-222222222222";
const base = { patient_id: P, source_document_id: D, confidence: 0.95, verified_by_patient: false, created_at: "2026-09-19T10:00:00Z" };

const input = {
  exportedAt: "2026-10-10T05:00:00Z",
  patient: { id: P, name: "Ravi Kumar", sex: "male", dob: "1971-03-14", blood_group: "B+", emergency_contact_name: "Priya Kumar", emergency_contact_phone: "+91 98450 31267" },
  allergies: [{ id: "a1", patient_id: P, substance: "Penicillin", severity: "severe", reaction: "Rash and swelling", created_at: "2026-01-01T00:00:00Z" }],
  conditions: [{ ...base, id: "c1", name: "Type 2 diabetes mellitus", category: "diabetes", diagnosed_on: "2025-11-12", status: "active", source_text: "K/c/o T2DM" }],
  medications: [
    { ...base, id: "m1", brand_name: "Glycomet", generic_name: "metformin", generics: ["metformin"], recognised: true, dose: "500 mg", frequency: "1-0-1", duration_days: 30, prescriber: "Dr. A. Suresh", start_date: "2026-08-20", active: true, stopped_on: null, source_text: "Tab. Glycomet 500 mg 1-0-1" },
    { ...base, id: "m2", brand_name: "Amlong", generic_name: "amlodipine", generics: ["amlodipine"], recognised: true, dose: "5 mg", frequency: "1-0-0", duration_days: null, prescriber: null, start_date: "2025-11-12", active: false, stopped_on: "2026-03-12", source_text: "Amlong 5" },
  ],
  labs: [
    { ...base, id: "l1", test_name: "Glycosylated Haemoglobin", test_code: "HBA1C", value: 7.4, value_text: "7.4", unit: "%", value_normalised: 7.4, unit_normalised: "%", ref_low: 4, ref_high: 5.6, ref_range_text: "4.0 - 5.6", test_date: "2026-09-19", facility: "Sri Ram Diagnostics", source_text: "HbA1c 7.4 %" },
    { ...base, id: "l2", test_name: "Vitamin D", test_code: null, value: 18, value_text: "18", unit: "ng/mL", value_normalised: null, unit_normalised: null, ref_low: null, ref_high: null, ref_range_text: null, test_date: "2026-09-19", facility: null, source_text: "Vit D 18" },
  ],
  documents: [{ id: D, type: "lab_report", doc_date: "2026-09-19", created_at: "2026-09-19T10:00:00Z", facility: "Sri Ram Diagnostics", doctor_name: null }],
} as unknown as FhirInput;

describe("FHIR R4 export", () => {
  const bundle = buildFhirBundle(input);
  const of = (type: string) => bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === type);

  it("is a collection Bundle with one entry per fact plus the patient", () => {
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    expect(of("Patient")).toHaveLength(1);
    expect(of("AllergyIntolerance")).toHaveLength(1);
    expect(of("Condition")).toHaveLength(1);
    expect(of("MedicationStatement")).toHaveLength(2);
    expect(of("Observation")).toHaveLength(3); // two labs + blood group
    expect(bundle.entry.every((e) => e.fullUrl === `urn:uuid:${e.resource.id}`)).toBe(true);
  });
  it("references the patient from every fact", () => {
    for (const r of bundle.entry.map((e) => e.resource).filter((r) => r.resourceType !== "Patient")) {
      const s = (r.subject ?? r.patient) as { reference: string };
      expect(s.reference).toBe(`urn:uuid:${P}`);
    }
  });
  it("codes known tests with LOINC and leaves unknown ones as text", () => {
    const [hba1c, vitd] = of("Observation").filter((o) => o.id === "l1" || o.id === "l2");
    expect((hba1c.code as { coding: { code: string }[] }).coding[0].code).toBe("4548-4");
    expect((vitd.code as { coding?: unknown; text: string })).toEqual({ text: "Vitamin D" });
    expect(hba1c.valueQuantity).toEqual({ value: 7.4, unit: "%" });
    expect(hba1c.referenceRange).toEqual([{ low: { value: 4, unit: "%" }, high: { value: 5.6, unit: "%" }, text: "4.0 - 5.6" }]);
  });
  it("keeps stopped medicines as stopped, with their period", () => {
    const amlong = of("MedicationStatement").find((m) => m.id === "m2")!;
    expect(amlong.status).toBe("stopped");
    expect(amlong.effectivePeriod).toEqual({ start: "2025-11-12", end: "2026-03-12" });
  });
  it("notes the source document and the words as written", () => {
    const hba1c = of("Observation").find((o) => o.id === "l1")!;
    expect(hba1c.note).toEqual([{ text: 'Source: Lab report, Sri Ram Diagnostics, 2026-09-19. Written as: "HbA1c 7.4 %"' }]);
  });
  it("marks severe allergies high criticality and exports blood group as LOINC 882-1", () => {
    expect(of("AllergyIntolerance")[0].criticality).toBe("high");
    const blood = of("Observation").find((o) => (o.code as { text: string }).text === "Blood group")!;
    expect(blood.valueCodeableConcept).toEqual({ text: "B+" });
  });
  it("drops empty optional fields instead of writing null", () => {
    expect(JSON.stringify(bundle)).not.toContain("null");
  });
});
