import { resolveShare } from "@/lib/sharing/resolve";
import { ok } from "@/lib/api/respond";

/** Before the name prompt: is this link usable, and does it need a code? Reveals nothing about the patient. */
export async function GET(request: Request) {
  const res = await resolveShare(request, "s-status");
  if ("response" in res) return res.response;
  return ok({ require_otp: res.ctx.link.require_otp, expires_at: res.ctx.link.expires_at });
}
