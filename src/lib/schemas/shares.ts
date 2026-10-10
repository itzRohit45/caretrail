import { z } from "zod";
import { CONDITION_FILTERS } from "@/lib/records/timeline";

export const EXPIRY_OPTIONS = { "1h": 60 * 60 * 1000, "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000 } as const;

export const createShareSchema = z
  .object({
    label: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(80).optional()),
    scope_type: z.enum(["all", "conditions", "months"]),
    scope_conditions: z.array(z.enum(CONDITION_FILTERS)).max(5).default([]),
    scope_months: z.union([z.literal(3), z.literal(6), z.literal(12)]).nullable().default(null),
    expires_in: z.enum(["1h", "24h", "7d"]),
    require_otp: z.boolean().default(false),
  })
  .refine((s) => s.scope_type !== "conditions" || s.scope_conditions.length > 0, { message: "Choose at least one condition.", path: ["scope_conditions"] })
  .refine((s) => s.scope_type !== "months" || s.scope_months !== null, { message: "Choose how many months.", path: ["scope_months"] });

const REG_NO = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/;

export const openShareSchema = z.object({
  viewer_name: z.string().trim().min(2, "Enter your name.").max(80),
  reg_no: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(3, "Check the registration number.").max(40).regex(REG_NO, "Use letters, numbers, spaces, dots, slashes or dashes.").optional(),
  ),
  otp: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{6}$/, "Enter the 6-digit code.").optional()),
});

/** Tier 2 emergency request: who is asking, from where, and their medical registration number. */
export const breakGlassSchema = z.object({
  viewer_name: z.string({ error: "Enter your name." }).trim().min(2, "Enter your name.").max(80),
  hospital: z.string({ error: "Enter the hospital or ambulance service." }).trim().min(2, "Enter the hospital or ambulance service.").max(120),
  reg_no: z
    .string({ error: "Enter your medical registration number." })
    .trim()
    .min(3, "Enter your medical registration number.")
    .max(40)
    .regex(REG_NO, "Use letters, numbers, spaces, dots, slashes or dashes."),
});
