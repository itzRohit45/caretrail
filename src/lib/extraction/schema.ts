import { z } from "zod";

// What the model must return. Validated before anything is stored or shown.

const confidence = z.number().min(0).max(1);
const sourceText = z.string().trim().min(1).max(600);
const field = z.object({ value: z.string().trim().min(1).max(300), confidence, source_text: sourceText });

export const DOCUMENT_TYPES = ["prescription", "lab_report", "discharge_summary", "scan_report", "other"] as const;

export const extractionSchema = z.object({
  is_medical_document: z.boolean(),
  document_type: z.enum(DOCUMENT_TYPES),
  document_date: field.optional(),
  facility: field.optional(),
  doctor_name: field.optional(),
  medications: z
    .array(
      z.object({
        brand_name: z.string().trim().min(1).max(120),
        strength: z.string().trim().max(60).optional(),
        frequency: z.string().trim().max(80).optional(),
        duration_days: z.number().int().min(1).max(3650).optional(),
        quantity: z.number().int().min(1).max(1000).optional(),
        instructions: z.string().trim().max(200).optional(),
        confidence,
        source_text: sourceText,
      }),
    )
    .max(40)
    .default([]),
  lab_results: z
    .array(
      z.object({
        test_name: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(40),
        unit: z.string().trim().max(40).optional(),
        ref_range: z.string().trim().max(80).optional(),
        test_date: z.string().trim().max(40).optional(),
        confidence,
        source_text: sourceText,
      }),
    )
    .max(80)
    .default([]),
  conditions: z.array(z.object({ name: z.string().trim().min(1).max(200), confidence, source_text: sourceText })).max(30).default([]),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** Models sometimes send null or "" for absent fields; the contract says omit them. */
export function dropEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropEmpty);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => [k, dropEmpty(v)]),
    );
  }
  return value;
}

// Same shape in the Gemini response-schema dialect (OpenAPI subset).
const gField = {
  type: "OBJECT",
  properties: { value: { type: "STRING" }, confidence: { type: "NUMBER" }, source_text: { type: "STRING" } },
  required: ["value", "confidence", "source_text"],
};
export const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    is_medical_document: { type: "BOOLEAN" },
    document_type: { type: "STRING", enum: [...DOCUMENT_TYPES] },
    document_date: gField,
    facility: gField,
    doctor_name: gField,
    medications: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          brand_name: { type: "STRING" },
          strength: { type: "STRING" },
          frequency: { type: "STRING" },
          duration_days: { type: "INTEGER" },
          quantity: { type: "INTEGER" },
          instructions: { type: "STRING" },
          confidence: { type: "NUMBER" },
          source_text: { type: "STRING" },
        },
        required: ["brand_name", "confidence", "source_text"],
      },
    },
    lab_results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          test_name: { type: "STRING" },
          value: { type: "STRING" },
          unit: { type: "STRING" },
          ref_range: { type: "STRING" },
          test_date: { type: "STRING" },
          confidence: { type: "NUMBER" },
          source_text: { type: "STRING" },
        },
        required: ["test_name", "value", "confidence", "source_text"],
      },
    },
    conditions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, confidence: { type: "NUMBER" }, source_text: { type: "STRING" } },
        required: ["name", "confidence", "source_text"],
      },
    },
  },
  required: ["is_medical_document", "document_type", "medications", "lab_results", "conditions"],
  propertyOrdering: ["is_medical_document", "document_type", "document_date", "facility", "doctor_name", "conditions", "medications", "lab_results"],
};
