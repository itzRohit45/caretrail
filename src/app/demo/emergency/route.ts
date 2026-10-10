import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/** Sample emergency card: the seeded Arun Prakash QR target. */
export async function GET(request: Request) {
  const token = serverEnv().DEMO_EMERGENCY_TOKEN;
  if (!token) return NextResponse.redirect(new URL("/?demo=unavailable", request.url));
  return NextResponse.redirect(new URL(`/e#${token}`, request.url), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
