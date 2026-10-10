import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { SafetyWarning } from "@/lib/safety/engine";
import { addedBy, formatDate, formatDateTime } from "@/lib/format";
import { DOC_TYPE_LABELS } from "@/lib/schemas/documents";

export const DISMISS_COOKIE = "ct-dismissed";

export type Alert = {
  id: string;
  kind: "break_glass" | "scan" | "check" | "note" | "meds";
  level: "severe" | "caution" | "info";
  title: string;
  detail: string;
  href: string;
  at: string;
};

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** Everything the patient should know about, newest and most serious first. Dismissing only hides it on Home. */
export async function loadAlerts(db: SupabaseClient<Database>, patientId: string, warnings: SafetyWarning[]): Promise<Alert[]> {
  const [events, waiting, notes] = await Promise.all([
    db.from("access_logs").select("id, action, viewer_name, viewer_hospital, created_at").eq("patient_id", patientId).in("action", ["emergency_scan", "break_glass"]).gte("created_at", daysAgo(7)).order("created_at", { ascending: false }).limit(20),
    db.from("documents").select("id, type, doc_date, created_at, uploaded_by").eq("patient_id", patientId).eq("upload_status", "uploaded").in("extraction_status", ["needs_review", "failed"]).order("created_at", { ascending: false }),
    db.from("doctor_notes").select("id, doctor_name, note, created_at").eq("patient_id", patientId).gte("created_at", daysAgo(14)).order("created_at", { ascending: false }).limit(10),
  ]);
  const alerts: Alert[] = [];

  for (const e of (events.data ?? []).filter((x) => x.action === "break_glass")) {
    alerts.push({
      id: `bg-${e.id}`,
      kind: "break_glass",
      level: "severe",
      title: `Emergency full access opened by ${e.viewer_name ?? "a clinician"}${e.viewer_hospital ? `, ${e.viewer_hospital}` : ""}`,
      detail: `${formatDateTime(e.created_at)}. It ends by itself after 2 hours. If this was not expected, end it now from Sharing.`,
      href: "/sharing",
      at: e.created_at,
    });
  }
  const scan = (events.data ?? []).find((x) => x.action === "emergency_scan");
  if (scan) {
    alerts.push({ id: `scan-${scan.id}`, kind: "scan", level: "caution", title: "Your emergency card was scanned", detail: `${formatDateTime(scan.created_at)}. If this was not expected, make a new QR on your emergency card.`, href: "/emergency-card", at: scan.created_at });
  }

  const docs = waiting.data ?? [];
  if (docs.length) {
    const d = docs[0];
    const who = addedBy(d.uploaded_by);
    const label = DOC_TYPE_LABELS[d.type as keyof typeof DOC_TYPE_LABELS] ?? "Record";
    alerts.push({
      id: `check-${docs.map((x) => x.id.slice(0, 8)).join("")}`,
      kind: "check",
      level: "caution",
      title: docs.length === 1 ? "1 record needs your check" : `${docs.length} records need your check`,
      detail: `${label}, ${formatDate(d.doc_date ?? d.created_at)}${who ? `, added by ${who}` : ""}. Nothing is added to your record until you check it.`,
      href: docs.length === 1 ? `/records/${d.id}` : "/records",
      at: d.created_at,
    });
  }

  for (const n of notes.data ?? []) {
    alerts.push({ id: `note-${n.id}`, kind: "note", level: "info", title: `Note from ${n.doctor_name}`, detail: n.note.length > 140 ? `${n.note.slice(0, 140)}...` : n.note, href: "/sharing", at: n.created_at });
  }

  const urgent = warnings.filter((w) => w.level !== "info");
  if (urgent.length) {
    const severe = urgent.filter((w) => w.level === "severe");
    alerts.push({
      // Changes whenever the set of warnings changes, so a new warning shows again after a dismissal.
      id: `meds-${hash(urgent.map((w) => w.id).sort().join("|"))}`,
      kind: "meds",
      level: severe.length ? "severe" : "caution",
      title: `${urgent.length} medicine ${urgent.length === 1 ? "warning" : "warnings"}`,
      detail: severe.length ? severe.map((w) => w.title).slice(0, 2).join(". ") : urgent.slice(0, 2).map((w) => w.title).join(". "),
      href: "/medicines",
      at: new Date().toISOString(),
    });
  }

  const rank = { severe: 0, caution: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.level] - rank[b.level] || b.at.localeCompare(a.at));
}

/** Dismissed alert ids from the cookie value ("id1,id2"). */
export function parseDismissed(value: string | undefined) {
  let raw = value ?? "";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // a malformed cookie is treated as empty
    raw = "";
  }
  return new Set(raw.split(",").filter(Boolean));
}
