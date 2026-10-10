import { patientForRequest } from "@/lib/auth";
import { buildFhirBundle } from "@/lib/export/fhir";
import { fail, unauthorized } from "@/lib/api/respond";
import { todayIST } from "@/lib/format";

/** FR-15: the logged-in patient's whole record as a FHIR R4 JSON bundle (row-level security applies). */
export async function GET() {
  const session = await patientForRequest();
  if (!session) return unauthorized();
  const { supabase, patient } = session;
  const [allergies, conditions, medications, labs, documents] = await Promise.all([
    supabase.from("allergies").select("*").eq("patient_id", patient.id).order("created_at"),
    supabase.from("conditions").select("*").eq("patient_id", patient.id).order("diagnosed_on"),
    supabase.from("medications").select("*").eq("patient_id", patient.id).order("start_date"),
    supabase.from("lab_results").select("*").eq("patient_id", patient.id).order("test_date"),
    supabase.from("documents").select("id, type, doc_date, created_at, facility, doctor_name").eq("patient_id", patient.id).eq("extraction_status", "completed"),
  ]);
  if ([allergies, conditions, medications, labs, documents].some((r) => r.error)) return fail(500, "Your record could not be exported. Please try again.");
  // Only facts from documents the patient has saved (pending reviews are not part of the record yet).
  const saved = new Set(documents.data!.map((d) => d.id));
  const bundle = buildFhirBundle({
    patient,
    allergies: allergies.data!,
    conditions: conditions.data!.filter((c) => saved.has(c.source_document_id)),
    medications: medications.data!.filter((m) => saved.has(m.source_document_id)),
    labs: labs.data!.filter((l) => saved.has(l.source_document_id)),
    documents: documents.data!,
    exportedAt: new Date().toISOString(),
  });
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="caretrail-record-${todayIST()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
