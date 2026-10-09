import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

/** Only same-site relative paths, so `?next=` cannot redirect off the app. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/home";
}
