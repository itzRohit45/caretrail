import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTimeline, timelineFilterSchema } from "@/lib/records/timeline";
import { PageBody, PageHeader } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordsTabs } from "@/components/records/records-tabs";
import { TimelineFilterBar } from "@/components/records/timeline-filters";
import { TimelineList } from "@/components/records/timeline-list";

export const metadata: Metadata = { title: "Records" };

export default async function RecordsPage({ searchParams }: PageProps<"/records">) {
  const { patient } = await requirePatient();
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = timelineFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : {};
  const supabase = await createClient();
  const { entries, total } = await loadTimeline(supabase, patient.id, filters);

  return (
    <>
      <PageHeader
        title="Your records"
        subtitle="Every prescription, lab report and hospital paper, newest first."
        aside={
          <Link href="/upload" className={buttonClass("primary", "dense")}>
            <Plus aria-hidden weight="bold" className="size-5" /> Add a record
          </Link>
        }
      />
      <PageBody>
        <RecordsTabs active="timeline" />
        {total === 0 ? (
          <EmptyState
            title="No records yet"
            body="Add a prescription or lab report and it will appear here, in date order, with what it says."
            action={
              <Link href="/upload" className={buttonClass("primary")}>
                <Plus aria-hidden weight="bold" className="size-5" /> Add your first record
              </Link>
            }
          />
        ) : (
          <>
            <TimelineFilterBar filters={filters} />
            {entries.length ? (
              <TimelineList entries={entries} />
            ) : (
              <EmptyState
                title="No records match"
                body="Try a different condition or time range."
                action={
                  <Link href="/records" className={buttonClass("secondary")}>
                    Clear filters
                  </Link>
                }
              />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
