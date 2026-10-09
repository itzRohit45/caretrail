import type { Metadata } from "next";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { PageBody, PageHeader, SheetSection } from "@/components/ui/page";
import { AddAllergyForm, AllergyItem, ProfileForm } from "@/components/patient/profile-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const { data: allergies, error } = await supabase
    .from("allergies")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <PageHeader title="Your profile" subtitle="Doctors and emergency staff rely on these details. Keep them current." />
      <PageBody>
        <ProfileForm patient={patient} />

        <SheetSection id="allergies" title="Allergies" description="CareTrail warns you if a new medicine matches one of these.">
          {error ? (
            <Alert tone="severe" title="Allergies could not load" role="alert">
              Refresh the page to try again.
            </Alert>
          ) : allergies.length === 0 ? (
            <p className="rounded-control bg-sheet-sunk px-4 py-3 text-ink-2">
              No allergies recorded. If you have none, leave this empty. Your emergency card will say &quot;No known allergies recorded&quot;.
            </p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {allergies.map((a) => (
                <AllergyItem key={a.id} allergy={a} />
              ))}
            </ul>
          )}
          <div className="mt-6 rounded-card bg-sheet-sunk p-4 sm:p-6">
            <h3 className="mb-4 text-lead font-bold">Add an allergy</h3>
            <AddAllergyForm />
          </div>
        </SheetSection>
      </PageBody>
    </>
  );
}
