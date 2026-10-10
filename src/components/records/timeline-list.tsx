import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import type { TimelineEntry } from "@/lib/records/timeline";
import { DOC_TYPE_LABELS } from "@/lib/schemas/documents";
import { CONDITION_LABELS } from "@/lib/normalise/conditions";
import { DateBlock } from "@/components/ui/date-block";
import { Badge } from "@/components/ui/badge";
import { DOC_ICONS } from "@/components/records/recent-records";
import { addedBy, medicineLabel } from "@/lib/format";

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${iso}T00:00:00+05:30`));

function summary(e: TimelineEntry) {
  const lines: string[] = [];
  if (e.medications.length) lines.push(e.medications.map((m) => medicineLabel(m.brand_name, m.dose)).join(", "));
  // A blood pressure reading is stored as two rows (systolic, diastolic); show it once, as written.
  const labs = e.labs.filter((l) => l.test_code !== "BP_DIA");
  const shown = labs.slice(0, 4).map((l) => {
    const value = l.test_code === "BP_SYS" ? l.value_text : (l.value ?? l.value_text);
    return `${l.test_name.replace(/\s*\(.*?\)\s*/g, " ").trim()} ${value}${l.unit ? ` ${l.unit}` : ""}`;
  });
  if (labs.length) lines.push(shown.join(", ") + (labs.length > 4 ? `, and ${labs.length - 4} more` : ""));
  if (e.conditions.length) lines.push(e.conditions.map((c) => c.name).join(", "));
  return lines;
}

export function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  const months = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), e]);
  }
  return (
    <div className="space-y-10">
      {[...months.entries()].map(([key, items]) => (
        <section key={key} aria-labelledby={`m-${key}`}>
          <h2 id={`m-${key}`} className="mb-4 font-serif text-title font-medium">
            {monthLabel(`${key}-01`)}
          </h2>
          <ol className="space-y-3">
            {items.map((e) => {
              const Icon = DOC_ICONS[e.type as keyof typeof DOC_ICONS];
              const waiting = e.extraction_status === "needs_review" || e.extraction_status === "failed";
              const lines = summary(e);
              return (
                <li key={e.id}>
                  <Link href={`/records/${e.id}`} className="group flex gap-3 rounded-card border border-rule bg-sheet p-3.5 transition-colors duration-150 hover:border-rule-strong sm:gap-5 sm:p-5">
                    <DateBlock date={e.date} responsive marker={e.doc_date_source === "upload" ? "Upload date" : undefined} />
                    <div className="min-w-0 flex-1 border-l border-rule pl-3 sm:pl-5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dense font-semibold text-ink-2">
                        <Icon aria-hidden weight="duotone" className="size-5 text-primary" />
                        {DOC_TYPE_LABELS[e.type as keyof typeof DOC_TYPE_LABELS]}
                        {waiting ? <Badge tone="needs-check">Check now</Badge> : null}
                      </p>
                      <p className="mt-1 text-lead font-bold">{e.facility ?? "Unnamed record"}</p>
                      {e.doctor_name ? <p className="text-ink-2">{e.doctor_name}</p> : null}
                      {addedBy(e.uploaded_by) ? <p className="text-dense font-semibold text-primary">Added by {addedBy(e.uploaded_by)}</p> : null}
                      {lines.length ? (
                        <ul className="mt-2 space-y-0.5 text-dense text-ink">
                          {lines.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      ) : null}
                      {e.condition_tags.length ? (
                        <p className="mt-3 flex flex-wrap gap-1.5">
                          {e.condition_tags.map((t) => (
                            <span key={t} className="rounded-pill bg-sheet-sunk px-2.5 py-0.5 text-meta font-semibold text-ink-2">
                              {CONDITION_LABELS[t] ?? t}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <CaretRight aria-hidden className="hidden size-5 shrink-0 self-center text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 sm:block" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
