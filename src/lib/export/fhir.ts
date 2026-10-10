import type { Row } from "@/lib/db/types";

// FR-15: the patient's record as a FHIR R4 Bundle (Patient, Condition, MedicationStatement, Observation,
// AllergyIntolerance). Built from stored rows only; every fact notes the document and words it came from.

// Only codes we are sure of. Anything else is exported as text, never guessed.
const LOINC: Record<string, { code: string; display: string; vital?: boolean }> = {
  HBA1C: { code: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood" },
  FBS: { code: "1558-6", display: "Fasting glucose [Mass/volume] in Serum or Plasma" },
  PPBS: { code: "1521-4", display: "Glucose [Mass/volume] in Serum or Plasma --2 hours post meal" },
  TSH: { code: "3016-3", display: "Thyrotropin [Units/volume] in Serum or Plasma" },
  FT4: { code: "3024-7", display: "Thyroxine (T4) free [Mass/volume] in Serum or Plasma" },
  LDL: { code: "2089-1", display: "Cholesterol in LDL [Mass/volume] in Serum or Plasma" },
  HDL: { code: "2085-9", display: "Cholesterol in HDL [Mass/volume] in Serum or Plasma" },
  TC: { code: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma" },
  TG: { code: "2571-8", display: "Triglyceride [Mass/volume] in Serum or Plasma" },
  CREAT: { code: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma" },
  UREA: { code: "3091-6", display: "Urea [Mass/volume] in Serum or Plasma" },
  HB: { code: "718-7", display: "Hemoglobin [Mass/volume] in Blood" },
  BP_SYS: { code: "8480-6", display: "Systolic blood pressure", vital: true },
  BP_DIA: { code: "8462-4", display: "Diastolic blood pressure", vital: true },
};

const TYPE_LABEL: Record<string, string> = { prescription: "Prescription", lab_report: "Lab report", discharge_summary: "Discharge summary", scan_report: "Scan report", consultation_note: "Consultation notes", other: "Document" };

type Doc = Pick<Row<"documents">, "id" | "type" | "doc_date" | "created_at" | "facility" | "doctor_name">;
export type FhirInput = {
  patient: Row<"patients">;
  allergies: Row<"allergies">[];
  conditions: Row<"conditions">[];
  medications: Row<"medications">[];
  labs: Row<"lab_results">[];
  documents: Doc[];
  exportedAt: string;
};

type Resource = { resourceType: string; id: string } & Record<string, unknown>;

export function buildFhirBundle(input: FhirInput) {
  const { patient: p } = input;
  const ref = (id: string) => `urn:uuid:${id}`;
  const subject = { reference: ref(p.id), display: p.name };
  const docs = new Map(input.documents.map((d) => [d.id, d]));
  const note = (documentId: string, quote: string | null) => {
    const d = docs.get(documentId);
    if (!d) return undefined;
    const where = [TYPE_LABEL[d.type] ?? "Document", d.facility, d.doc_date ?? d.created_at.slice(0, 10)].filter(Boolean).join(", ");
    return [{ text: `Source: ${where}${quote ? `. Written as: "${quote}"` : ""}` }];
  };

  const resources: Resource[] = [
    {
      resourceType: "Patient",
      id: p.id,
      name: [{ text: p.name }],
      gender: p.sex ?? "unknown",
      birthDate: p.dob ?? undefined,
      contact: p.emergency_contact_name || p.emergency_contact_phone
        ? [{
            relationship: [{ text: "Emergency contact" }],
            name: p.emergency_contact_name ? { text: p.emergency_contact_name } : undefined,
            telecom: p.emergency_contact_phone ? [{ system: "phone", value: p.emergency_contact_phone }] : undefined,
          }]
        : undefined,
    },
    // Blood group the patient entered, as the standard ABO/Rh observation.
    ...(p.blood_group
      ? [{
          resourceType: "Observation",
          id: `${p.id.slice(0, 24)}b100d0000000`,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
          code: { coding: [{ system: "http://loinc.org", code: "882-1", display: "ABO and Rh group [Type] in Blood" }], text: "Blood group" },
          subject,
          valueCodeableConcept: { text: p.blood_group },
          note: [{ text: "Entered by the patient." }],
        }]
      : []),
    ...input.allergies.map((a) => ({
      resourceType: "AllergyIntolerance",
      id: a.id,
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
      code: { text: a.substance },
      criticality: a.severity === "severe" ? "high" : "low",
      patient: subject,
      reaction: [{ manifestation: [{ text: a.reaction ?? "Not recorded" }], severity: a.severity }],
      note: [{ text: "Entered by the patient." }],
    })),
    ...input.conditions.map((c) => ({
      resourceType: "Condition",
      id: c.id,
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: c.status === "resolved" ? "resolved" : "active" }] },
      code: { text: c.name },
      subject,
      recordedDate: c.diagnosed_on ?? undefined,
      note: note(c.source_document_id, c.source_text),
    })),
    ...input.medications.map((m) => ({
      resourceType: "MedicationStatement",
      id: m.id,
      status: m.active ? "active" : "stopped",
      medicationCodeableConcept: { text: m.generic_name ? `${m.brand_name} (${m.generic_name})` : m.brand_name },
      subject,
      effectivePeriod: m.start_date || m.stopped_on ? { start: m.start_date ?? undefined, end: m.stopped_on ?? undefined } : undefined,
      informationSource: m.prescriber ? { display: m.prescriber } : undefined,
      dosage: m.dose || m.frequency ? [{ text: [m.dose, m.frequency].filter(Boolean).join(", ") }] : undefined,
      note: note(m.source_document_id, m.source_text),
    })),
    ...input.labs.map((l) => {
      const loinc = l.test_code ? LOINC[l.test_code] : undefined;
      const value = l.value ?? l.value_normalised;
      const unit = l.value !== null ? l.unit : l.unit_normalised;
      return {
        resourceType: "Observation",
        id: l.id,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: loinc?.vital ? "vital-signs" : "laboratory" }] }],
        code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc.code, display: loinc.display }] : undefined, text: l.test_name },
        subject,
        effectiveDateTime: l.test_date,
        valueQuantity: value !== null ? { value, unit: unit ?? undefined } : undefined,
        valueString: value === null ? (l.value_text ?? undefined) : undefined,
        referenceRange:
          l.ref_low !== null || l.ref_high !== null || l.ref_range_text
            ? [{ low: l.ref_low !== null ? { value: l.ref_low, unit: unit ?? undefined } : undefined, high: l.ref_high !== null ? { value: l.ref_high, unit: unit ?? undefined } : undefined, text: l.ref_range_text ?? undefined }]
            : undefined,
        note: note(l.source_document_id, l.source_text),
      };
    }),
  ];

  // JSON drops undefined keys, so optional fields simply disappear from the file.
  return JSON.parse(
    JSON.stringify({
      resourceType: "Bundle",
      type: "collection",
      timestamp: input.exportedAt,
      entry: resources.map((r) => ({ fullUrl: ref(r.id), resource: r })),
    }),
  ) as { resourceType: "Bundle"; type: "collection"; timestamp: string; entry: { fullUrl: string; resource: Resource }[] };
}
