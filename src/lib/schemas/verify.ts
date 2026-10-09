import { z } from "zod";

// What the patient sends back from the verify screen (or what auto-save builds from a confident extraction).

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const confidence = z.number().min(0).max(1).nullable();

export const verifySchema = z.object({
  doc_date: z.iso.date().nullable(),
  facility: optionalText(200),
  doctor_name: optionalText(200),
  medications: z
    .array(
      z.object({
        brand_name: text(120),
        dose: optionalText(60),
        frequency: optionalText(80),
        duration_days: z.number().int().min(1).max(3650).nullable(),
        source_text: text(600),
        confidence,
        patient_verified: z.boolean(),
      }),
    )
    .max(40),
  lab_results: z
    .array(
      z.object({
        test_name: text(120),
        value: text(40),
        unit: optionalText(40),
        ref_range: optionalText(80),
        test_date: z.iso.date().nullable(),
        source_text: text(600),
        confidence,
        patient_verified: z.boolean(),
      }),
    )
    .max(80),
  conditions: z
    .array(z.object({ name: text(200), source_text: text(600), confidence, patient_verified: z.boolean() }))
    .max(30),
});

export type VerifyPayload = z.infer<typeof verifySchema>;
