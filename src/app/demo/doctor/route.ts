import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/sharing/request";
import { hashToken, newToken } from "@/lib/sharing/tokens";

/** Sample doctor's view: mints a real 1-hour link to the seeded Ravi record, exactly as a patient would. */
export async function GET(request: Request) {
  // Judges often share one venue IP, so the hourly cap is generous; a page visit gets a page, not JSON.
  if (!(await allowRequest(request, "demo-doctor", 60, 3600))) return NextResponse.redirect(new URL("/?demo=busy", request.url));
  const admin = adminClient();
  const { data: ravi } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", "Ravi Kumar").maybeSingle();
  if (!ravi) return NextResponse.redirect(new URL("/?demo=unavailable", request.url));
  const token = newToken();
  const { error } = await admin.from("share_links").insert({
    patient_id: ravi.id,
    token_hash: hashToken(token),
    label: "Sample doctor link",
    scope_type: "all",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.redirect(new URL("/?demo=unavailable", request.url));
  return NextResponse.redirect(new URL(`/s?sample=1#${token}`, request.url), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
