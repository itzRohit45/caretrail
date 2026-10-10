import { resolveViewer } from "@/lib/sharing/resolve";
import { buildBrief } from "@/lib/brief/build";
import { fail, ok } from "@/lib/api/respond";

/** The scoped, source-linked brief. Token and viewer session re-checked on this call. */
export async function GET(request: Request) {
  const res = await resolveViewer(request, "s-brief");
  if ("response" in res) return res.response;
  try {
    const brief = await buildBrief(res.ctx.link, res.ctx.patient);
    return ok({ ...brief, viewer: res.ctx.session.viewer_name, break_glass: res.ctx.link.is_break_glass });
  } catch {
    return fail(500, "The records could not load. Please refresh.");
  }
}
