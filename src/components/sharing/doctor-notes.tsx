import { NotePencil } from "@phosphor-icons/react/ssr";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

/** Every note a doctor left through a share link, newest first (row-level security: the patient's own). */
export async function DoctorNotes({ patientId }: { patientId: string }) {
  const supabase = await createClient();
  const [{ data: notes }, { data: links }] = await Promise.all([
    supabase.from("doctor_notes").select("id, share_link_id, doctor_name, note, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("share_links").select("id, label").eq("patient_id", patientId),
  ]);
  if (!notes?.length) return null;
  const label = (id: string) => links?.find((l) => l.id === id)?.label;
  return (
    <section aria-labelledby="notes-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-6">
      <h2 id="notes-title" className="flex items-center gap-2 text-title font-bold">
        <NotePencil aria-hidden className="size-6" /> Notes from your doctors <span className="font-normal text-ink-2">({notes.length})</span>
      </h2>
      <ul className="mt-3 divide-y divide-rule">
        {notes.map((n) => (
          <li key={n.id} className="py-3">
            <p className="whitespace-pre-line">{n.note}</p>
            <p className="mt-1 text-dense text-ink-2">
              {n.doctor_name}, {formatDateTime(n.created_at)}
              {label(n.share_link_id) ? `, through "${label(n.share_link_id)}"` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
