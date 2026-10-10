import { resolveViewer } from "@/lib/sharing/resolve";
import { buildBrief } from "@/lib/brief/build";
import { adminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api/respond";
import type { Row } from "@/lib/db/types";

/** What was added through this link (write-back links only): notes and uploads with their status. */
async function writeBack(link: Row<"share_links">) {
  if (!link.allow_write_back) return null;
  const db = adminClient();
  const [notes, logs] = await Promise.all([
    db.from("doctor_notes").select("id, doctor_name, note, created_at").eq("share_link_id", link.id).order("created_at", { ascending: false }),
    db.from("access_logs").select("target_id").eq("share_link_id", link.id).eq("action", "added_document"),
  ]);
  const ids = (logs.data ?? []).map((l) => l.target_id).filter((id): id is string => Boolean(id));
  const { data: docs } = ids.length
    ? await db.from("documents").select("id, original_filename, extraction_status, created_at").in("id", ids).order("created_at", { ascending: false })
    : { data: [] };
  return {
    notes: notes.data ?? [],
    uploads: (docs ?? []).map((d) => ({ id: d.id, filename: d.original_filename, status: d.extraction_status, created_at: d.created_at })),
  };
}

/** The scoped, source-linked brief. Token and viewer session re-checked on this call. */
export async function GET(request: Request) {
  const res = await resolveViewer(request, "s-brief");
  if ("response" in res) return res.response;
  try {
    const [brief, added] = await Promise.all([buildBrief(res.ctx.link, res.ctx.patient, res.ctx.session.previous_visit_at), writeBack(res.ctx.link)]);
    return ok({ ...brief, viewer: res.ctx.session.viewer_name, break_glass: res.ctx.link.is_break_glass, write_back: added });
  } catch {
    return fail(500, "The records could not load. Please refresh.");
  }
}
