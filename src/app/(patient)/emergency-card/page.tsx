import type { Metadata } from "next";
import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react/ssr";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader, SheetSection } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import { EmergencyPreview } from "@/components/patient/emergency-preview";
import { EmergencyQrManager } from "@/components/emergency/emergency-qr-manager";

export const metadata: Metadata = { title: "Emergency card" };

export default async function EmergencyCardPage() {
  const { patient } = await requirePatient();
  const { data: allergies } = await (await createClient()).from("allergies").select("*").eq("patient_id", patient.id).order("created_at");
  return (
    <>
      <PageHeader title="Your emergency card" subtitle="If you cannot speak, a hospital can still see your allergies, medicines and who to call." />
      <PageBody>
        <EmergencyQrManager
          activeSince={patient.emergency_token_created_at}
          facts={{
            name: patient.name,
            blood_group: patient.blood_group,
            allergies: (allergies ?? []).map((a) => a.substance),
            contact: patient.emergency_contact_phone ? `${patient.emergency_contact_name ?? ""} ${patient.emergency_contact_phone}`.trim() : null,
          }}
        />
        <SheetSection
          id="preview"
          title="What responders see first"
          description="Plus your current medicines and main conditions, taken from your records."
          action={
            <Link href="/profile" className={buttonClass("secondary", "dense")}>
              <PencilSimple aria-hidden className="size-4" /> Edit
            </Link>
          }
        >
          <div className="max-w-md">
            <EmergencyPreview patient={patient} allergies={allergies ?? []} />
          </div>
        </SheetSection>
      </PageBody>
    </>
  );
}
