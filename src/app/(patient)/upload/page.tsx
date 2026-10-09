import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Uploader } from "@/components/records/uploader";

export const metadata: Metadata = { title: "Add a record" };

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Add a record" subtitle="A prescription, lab report or discharge summary. CareTrail reads it, and you check anything it is unsure about." />
      <PageBody>
        <Uploader />
      </PageBody>
    </>
  );
}
