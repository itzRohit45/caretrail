import Link from "next/link";
import { FileText, Prescription, Flask, FirstAid, Scan, CaretRight } from "@phosphor-icons/react/ssr";
import { DOC_TYPE_LABELS } from "@/lib/schemas/documents";
import { addedBy, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { Row } from "@/lib/db/types";

export const DOC_ICONS = { prescription: Prescription, lab_report: Flask, discharge_summary: FirstAid, scan_report: Scan, other: FileText } as const;

type Doc = Pick<Row<"documents">, "id" | "type" | "doc_date" | "created_at" | "facility" | "doctor_name" | "extraction_status"> & { uploaded_by?: string };

export function RecordRow({ doc }: { doc: Doc }) {
  const Icon = DOC_ICONS[doc.type as keyof typeof DOC_ICONS] ?? FileText;
  const waiting = doc.extraction_status === "needs_review" || doc.extraction_status === "failed";
  return (
    <li>
      <Link href={`/records/${doc.id}`} className="-mx-2 flex min-h-16 items-center gap-3 rounded-control px-2 py-2 transition-colors duration-150 hover:bg-sheet-sunk">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <Icon aria-hidden weight="duotone" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{doc.facility ?? DOC_TYPE_LABELS[doc.type as keyof typeof DOC_TYPE_LABELS]}</span>
          <span className="block text-dense text-ink-2">
            {DOC_TYPE_LABELS[doc.type as keyof typeof DOC_TYPE_LABELS]}, {formatDate(doc.doc_date ?? doc.created_at)}
          </span>
          {addedBy(doc.uploaded_by) ? <span className="block text-dense font-semibold text-primary">Added by {addedBy(doc.uploaded_by)}</span> : null}
        </span>
        {waiting ? <Badge tone="needs-check">Check now</Badge> : null}
        <CaretRight aria-hidden className="size-5 shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}
