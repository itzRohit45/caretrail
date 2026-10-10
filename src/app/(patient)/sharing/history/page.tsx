import type { Metadata } from "next";
import { requirePatient } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/ui/page";
import { SharingTabs } from "@/components/sharing/sharing-tabs";
import { AccessHistory } from "@/components/sharing/access-history";

export const metadata: Metadata = { title: "Access history" };

export default async function AccessHistoryPage() {
  await requirePatient();
  return (
    <>
      <PageHeader title="Who saw your records" subtitle="Every time someone opens a link you shared or scans your emergency card, it is recorded here." />
      <PageBody>
        <SharingTabs active="history" />
        <AccessHistory />
      </PageBody>
    </>
  );
}
