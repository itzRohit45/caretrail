import type { Metadata } from "next";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-display font-bold">Your profile</h1>
        <p className="text-ink-2">Doctors and emergency staff rely on these details. Keep them current.</p>
      </div>

      <Card className="p-5">
        <ProfileForm patient={patient} />
      </Card>

      <Card className="p-5" as="section">
        <h2 className="text-title font-bold">Allergies</h2>
        <p className="mt-1 text-ink-2">CareTrail warns you if a new medicine matches one of these.</p>
        {error ? (
          <Alert tone="severe" title="Allergies could not load" className="mt-4" role="alert">
            Refresh the page to try again.
          </Alert>
        ) : allergies.length === 0 ? (
          <p className="mt-4 rounded-control bg-sheet-sunk px-4 py-3 text-ink-2">
            No allergies recorded. If you have none, leave this empty. Your emergency card will say &quot;No known allergies recorded&quot;.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {allergies.map((a) => (
              <AllergyItem key={a.id} allergy={a} />
            ))}
          </ul>
        )}
        <div className="mt-6 border-t border-rule pt-6">
          <h3 className="mb-4 text-lead font-bold">Add an allergy</h3>
          <AddAllergyForm />
        </div>
      </Card>
    </div>
  );
}
