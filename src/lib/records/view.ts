import type { CheckReason } from "./review";

// Shapes passed from the record page (server) to the verify form (client).

export type ReviewMed = {
  brand_name: string;
  dose: string;
  frequency: string;
  duration_days: number | null;
  source_text: string;
  confidence: number | null;
  reasons: CheckReason[];
  generics: string[];
};
export type ReviewLab = {
  test_name: string;
  value: string;
  unit: string;
  ref_range: string;
  test_date: string | null;
  source_text: string;
  confidence: number | null;
  reasons: CheckReason[];
};
export type ReviewCondition = { name: string; source_text: string; confidence: number | null; reasons: CheckReason[] };

export type ReviewModel = {
  documentId: string;
  failed: boolean;
  failReason: string | null;
  doc_date: string | null;
  dateMissing: boolean;
  uploadDate: string;
  facility: string;
  doctor_name: string;
  medications: ReviewMed[];
  labs: ReviewLab[];
  conditions: ReviewCondition[];
};

export const MANUAL_SOURCE = "Entered by patient";
