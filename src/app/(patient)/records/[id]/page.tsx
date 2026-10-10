import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Plus } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { extractionSchema } from "@/lib/extraction/schema";
import { reviewPlan } from "@/lib/records/review";
import { loadReference } from "@/lib/records/save";
import { matchBrand } from "@/lib/normalise/brands";
import { toIsoDate } from "@/lib/normalise/dates";
import { addedBy, formatDate } from "@/lib/format";
import { DOC_TYPE_LABELS } from "@/lib/schemas/documents";
import type { ReviewModel } from "@/lib/records/view";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DocumentPreview } from "@/components/records/document-preview";
import { ReviewForm } from "@/components/records/review-form";
import { ProcessingWatcher } from "@/components/records/processing-watcher";
import { SavedFacts } from "@/components/records/saved-facts";
import { dosesPerDay, readDosing } from "@/lib/normalise/frequency";

export const metadata: Metadata = { title: "Record" };

export default async function RecordPage({ params }: PageProps<"/records/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requirePatient();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc) notFound();

  const typeLabel = DOC_TYPE_LABELS[doc.type as keyof typeof DOC_TYPE_LABELS] ?? "Record";

  if (doc.extraction_status === "pending" || doc.extraction_status === "processing") {
    return (
      <>
        <PageHeader kicker={typeLabel} title="Reading your document" subtitle="We will show you what we read so you can check it." />
        <PageBody>
          <ProcessingWatcher documentId={doc.id} status={doc.extraction_status} />
        </PageBody>
      </>
    );
  }

  if (doc.extraction_status === "needs_review" || doc.extraction_status === "failed") {
    const parsed = doc.extraction ? extractionSchema.safeParse(doc.extraction) : null;
    const x = parsed?.success ? parsed.data : null;
    const ref = await loadReference(supabase);
    const plan = x ? reviewPlan(x, ref.index) : null;
    const model: ReviewModel = {
      documentId: doc.id,
      failed: doc.extraction_status === "failed",
      failReason: doc.extraction_error,
      doc_date: toIsoDate(x?.document_date?.value),
      dateMissing: plan?.dateMissing ?? true,
      uploadDate: formatDate(doc.created_at),
      facility: x?.facility?.value ?? "",
      doctor_name: x?.doctor_name?.value ?? "",
      medications: (x?.medications ?? []).map((m, i) => {
        const d = readDosing(m);
        return {
          brand_name: m.brand_name,
          dose: m.strength ?? "",
          frequency: d.frequency ?? "",
          duration_days: d.duration_days,
          days_note: d.daysFromQuantity ? `Worked out from ${d.quantity} written on the paper, ${dosesPerDay(d.frequency)} a day` : undefined,
          source_text: m.source_text,
          confidence: m.confidence,
          reasons: plan?.medications[i] ?? [],
          generics: matchBrand(m.brand_name, ref.index).generics,
        };
      }),
      labs: (x?.lab_results ?? []).map((l, i) => ({
        test_name: l.test_name,
        value: l.value,
        unit: l.unit ?? "",
        ref_range: l.ref_range ?? "",
        test_date: toIsoDate(l.test_date),
        source_text: l.source_text,
        confidence: l.confidence,
        reasons: plan?.labs[i] ?? [],
      })),
      conditions: (x?.conditions ?? []).map((c, i) => ({ name: c.name, source_text: c.source_text, confidence: c.confidence, reasons: plan?.conditions[i] ?? [] })),
    };
    return (
      <>
        <PageHeader
          kicker={typeLabel}
          title={model.failed ? "Add the details" : "Check what we read"}
          subtitle={
            addedBy(doc.uploaded_by)
              ? `${addedBy(doc.uploaded_by)} added this through your share link. Check every medicine and dose; nothing joins your record until you save.`
              : model.failed ? "Type in what the document says. It takes a minute." : "Compare with the document. Fix anything that is wrong, then save."
          }
          width="wide"
        />
        <PageBody width="wide">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="lg:sticky lg:top-24">
              <DocumentPreview documentId={doc.id} collapsible />
            </div>
            <ReviewForm model={model} />
          </div>
        </PageBody>
      </>
    );
  }

  const [meds, labs, conds, ranges] = await Promise.all([
    supabase.from("medications").select("*").eq("source_document_id", doc.id).order("created_at"),
    supabase.from("lab_results").select("*").eq("source_document_id", doc.id).order("created_at"),
    supabase.from("conditions").select("*").eq("source_document_id", doc.id).order("created_at"),
    supabase.from("lab_reference_ranges").select("test_code, low, high"),
  ]);
  const skipped = doc.extraction_status === "skipped";

  return (
    <>
      <PageHeader
        kicker={
          <span className="flex flex-wrap items-center gap-2">
            {doc.doc_date ? formatDate(doc.doc_date) : formatDate(doc.created_at)}
            {doc.doc_date_source === "upload" ? <Badge tone="needs-check">Upload date used</Badge> : null}
            {addedBy(doc.uploaded_by) ? <Badge tone="doctor-added">Added by {addedBy(doc.uploaded_by)}</Badge> : null}
          </span>
        }
        title={skipped ? "Not a medical document" : (doc.facility ?? typeLabel)}
        subtitle={skipped ? "It is saved, but nothing was added to your record." : [typeLabel, doc.doctor_name].filter(Boolean).join(", ")}
        aside={
          <Link href="/upload" className={buttonClass("secondary", "dense")}>
            <Plus aria-hidden className="size-5" /> Add another
          </Link>
        }
        width="wide"
      />
      <PageBody width="wide">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="order-2 lg:sticky lg:top-24 lg:order-1">
            <DocumentPreview documentId={doc.id} />
          </div>
          <div className="order-1 lg:order-2">
            {skipped ? null : <SavedFacts medications={meds.data ?? []} labs={labs.data ?? []} conditions={conds.data ?? []} ranges={ranges.data ?? []} />}
          </div>
        </div>
      </PageBody>
    </>
  );
}
