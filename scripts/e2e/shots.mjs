// Captures key screens at phone / tablet / desktop widths for design review.
// Usage: node --env-file=.env.local scripts/e2e/shots.mjs [out-dir]
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? ".impeccable/review";
const email = `shots-${Date.now()}@example.com`;
const password = "shots-test-pass-123";
const widths = { mobile: [390, 844], tablet: [768, 1024], desktop: [1280, 860] };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Ravi Kumar" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
await admin.from("patients").update({ dob: "1971-03-14", sex: "male", blood_group: "B+", emergency_contact_name: "Priya Kumar", emergency_contact_phone: "+91 98400 12345" }).eq("id", patient.id);
await admin.from("allergies").insert({ patient_id: patient.id, substance: "Penicillin", severity: "severe", reaction: "Rash and swelling" });

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, [w, h]] of Object.entries(widths)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: name === "mobile", hasTouch: name === "mobile" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.screenshot({ path: `${out}/landing-${name}.png`, fullPage: true, caret: "initial" });
    await page.goto(`${BASE}/login`);
    await page.screenshot({ path: `${out}/login-${name}.png`, fullPage: true, caret: "initial" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/home");
    await page.getByText("Your emergency card").waitFor();
    await page.screenshot({ path: `${out}/home-${name}.png`, fullPage: true, caret: "initial" });
    await page.goto(`${BASE}/profile`);
    await page.getByText("Add an allergy").waitFor();
    await page.screenshot({ path: `${out}/profile-${name}.png`, fullPage: true, caret: "initial" });
    await ctx.close();
  }
  console.log("screenshots written to", out);
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
}
