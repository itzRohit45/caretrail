import type { Extraction } from "@/lib/extraction/schema";
import { matchBrand } from "@/lib/normalise/brands";

export const CONFIDENCE_THRESHOLD = 0.85;

export type CheckReason = "low_confidence" | "dose" | "unrecognised";

/**
 * PRD routing: any field under 0.85, every medicine dose and frequency, and any unrecognised
 * brand go to the patient before saving. A document with none of these is saved directly.
 */
export function reviewPlan(x: Extraction, brandIndex: Map<string, Set<string>>) {
  const low = (c: number | undefined) => c !== undefined && c < CONFIDENCE_THRESHOLD;
  const medications = x.medications.map((m) => {
    const reasons: CheckReason[] = ["dose"];
    if (low(m.confidence)) reasons.push("low_confidence");
    if (!matchBrand(m.brand_name, brandIndex).recognised) reasons.push("unrecognised");
    return reasons;
  });
  const labs = x.lab_results.map((l): CheckReason[] => (low(l.confidence) ? ["low_confidence"] : []));
  const conditions = x.conditions.map((c): CheckReason[] => (low(c.confidence) ? ["low_confidence"] : []));
  const dateMissing = !x.document_date || low(x.document_date.confidence);
  const headerUnsure = low(x.facility?.confidence) || low(x.doctor_name?.confidence);
  const needsReview =
    dateMissing || headerUnsure || medications.length > 0 || labs.some((r) => r.length) || conditions.some((r) => r.length);
  return { needsReview, dateMissing, medications, labs, conditions };
}
