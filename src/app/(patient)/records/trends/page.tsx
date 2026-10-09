import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTrends } from "@/lib/records/trends";
import { PageBody, PageHeader } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { RecordsTabs } from "@/components/records/records-tabs";
import { TrendCard } from "@/components/records/trend-chart";

export const metadata: Metadata = { title: "Trends" };

export default async function TrendsPage() {
  const { patient } = await requirePatient();
  const trends = await loadTrends(await createClient(), patient.id);
  const withData = trends.filter((t) => t.points.length > 0);
  const empty = trends.filter((t) => t.points.length === 0);

  return (
    <>
      <PageHeader
        title="Your trends"
        subtitle="How your key results have changed over time. Tap any point to open the report it came from."
        aside={
          <Link href="/upload" className={buttonClass("primary", "dense")}>
            <Plus aria-hidden weight="bold" className="size-5" /> Add a record
          </Link>
        }
      />
      <PageBody>
        <RecordsTabs active="trends" />
        <div className="grid gap-6">
          {[...withData, ...empty].map((t) => (
            <TrendCard key={t.key} trend={t} />
          ))}
        </div>
        <p className="text-meta text-ink-3">Values are shown in one unit per chart; anything converted shows the printed value too. Normal ranges are standard adult ranges.</p>
      </PageBody>
    </>
  );
}
