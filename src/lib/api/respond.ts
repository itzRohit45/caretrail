import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** PRD response convention: JSON `{ data, error }`. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { data: null, error: { message, ...extra } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export const unauthorized = () => fail(401, "Please log in again.");
export const forbidden = () => fail(403, "This item is outside what was shared.");
/** Unknown, expired and revoked tokens get the same body, so tokens cannot be probed. */
export const accessEnded = () => fail(410, "Access ended");
export const tooMany = () => fail(429, "Too many requests. Please wait a minute and try again.");
export const invalid = (err: ZodError) =>
  fail(422, "Some details are not valid.", {
    fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
