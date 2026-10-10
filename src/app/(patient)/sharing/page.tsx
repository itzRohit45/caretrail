import type { Metadata } from "next";
import { requirePatient } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/ui/page";
import { SharingTabs } from "@/components/sharing/sharing-tabs";
import { ShareManager } from "@/components/sharing/share-manager";

export const metadata: Metadata = { title: "Sharing" };

export default async function SharingPage() {
  await requirePatient();
  return (
    <>
      <PageHeader title="Share your records" subtitle="Give a doctor a link that shows only what you choose, for as long as you choose. You can end it any time." />
      <PageBody>
        <SharingTabs active="links" />
        <ShareManager />
      </PageBody>
    </>
  );
}
