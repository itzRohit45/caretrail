import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const SEXES = ["female", "male", "other"] as const;
export const SEVERITIES = ["mild", "moderate", "severe"] as const;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  dob: z.preprocess(
    blank,
    z.iso.date("Enter a valid date.").refine((d) => d > "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Enter a real date of birth.").nullable(),
  ),
  sex: z.preprocess(blank, z.enum(SEXES).nullable()),
  blood_group: z.preprocess(blank, z.enum(BLOOD_GROUPS, "Choose a blood group.").nullable()),
  emergency_contact_name: z.preprocess(blank, z.string().trim().max(120).nullable()),
  emergency_contact_phone: z.preprocess(
    blank,
    z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Enter a phone number with digits only, for example +91 98400 12345.").nullable(),
  ),
  emergency_contact_email: z.preprocess(blank, z.email("Enter a valid email address.").max(254).nullable()),
});

export const allergySchema = z.object({
  substance: z.string().trim().min(1, "Enter what you are allergic to.").max(80),
  severity: z.enum(SEVERITIES, "Choose how serious it is."),
  reaction: z.preprocess(blank, z.string().trim().max(200).nullable()),
});
