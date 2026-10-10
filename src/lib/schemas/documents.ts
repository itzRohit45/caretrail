import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DOC_TYPES = ["prescription", "lab_report", "consultation_note", "discharge_summary", "scan_report", "other"] as const;

export const DOC_TYPE_LABELS: Record<(typeof DOC_TYPES)[number], string> = {
  prescription: "Prescription",
  lab_report: "Lab report",
  discharge_summary: "Discharge summary",
  scan_report: "Scan report",
  consultation_note: "Consultation notes",
  other: "Other",
};

export const createDocumentSchema = z.object({
  file_hash: z.string().regex(/^[a-f0-9]{64}$/, "Invalid file fingerprint."),
  size_bytes: z.number().int().positive(),
  mime_type: z.enum(ACCEPTED_TYPES, "Only PDF, JPG or PNG files can be uploaded."),
  original_filename: z.string().trim().max(255).optional(),
  type: z.enum(DOC_TYPES, "Choose what kind of record this is."),
});
