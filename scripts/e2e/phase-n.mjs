// Add a record from typed consultation notes (no file needed), notes plus a prescription photo, and a real
// handwritten prescription (if /tmp/ct-tools/rx/rx.jpg exists locally; it is never committed).
// Usage: node --env-file=.env.local scripts/e2e/phase-n.mjs
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasen-${Date.now()}@example.com`;
const password = "phase-n-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Hari Test" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const hashes = [];

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");

  // 1. Typed notes only.
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Consultation notes" }).click();
  check("notes form shown; file is optional", await seen(page.getByRole("heading", { name: "Write the notes" })) && (await seen(page.getByText("Photo of the prescription (optional)"))));
  check("save stays off until notes are written", await page.getByRole("button", { name: "Save notes" }).isDisabled());
  await page.getByLabel("Doctor").fill("Dr. S. Ravindran");
  await page.getByLabel("Clinic or hospital").fill("Ravi Neuro Clinic");
  await page.getByLabel("Notes", { exact: true }).fill("Diagnosis: Acute wheezy bronchitis.\nTab Dolo 650 mg 1-1-1 = (15)\nTab Pantocid 40 mg 1-0-0 x 5 days\nReview after 1 week.");
  await page.screenshot({ path: `${shots}/consultation-notes-mobile.png`, fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  check("notes read: medicines go to the check screen", await seen(page.getByRole("heading", { name: "Check what we read" }), 90000));
  const freqs = await page.locator("input[id^=freq-]").evaluateAll((els) => els.map((e) => e.value));
  const days = await page.locator("input[id^=days-]").evaluateAll((els) => els.map((e) => e.value));
  check(`how often filled (${freqs.join(" | ")})`, freqs.some((f) => /1-1-1/.test(f)) && freqs.some((f) => /1-0-0/.test(f)));
  check(`days filled, 15 tablets at 3 a day = 5 (${days.join(" | ")})`, days.filter((d) => d === "5").length === 2);
  check("explains days worked out from the quantity", await seen(page.getByText(/Worked out from 15 written on the paper, 3 a day/)));
  await page.screenshot({ path: `${shots}/consultation-review-mobile.png`, fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Save to my record" }).click();
  await page.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });
  const { data: notesDoc } = await admin.from("documents").select("type, mime_type, original_filename, file_hash").eq("patient_id", patient.id).single();
  hashes.push(notesDoc?.file_hash);
  check(`stored as a consultation-notes record (${notesDoc?.type}, ${notesDoc?.original_filename})`, notesDoc?.type === "consultation_note" && notesDoc.mime_type === "application/pdf");
  await page.goto(`${BASE}/medicines`);
  check("medicines from the notes are current", await seen(page.getByRole("button", { name: /^Stop Dolo/ })) && (await seen(page.getByRole("button", { name: /^Stop Pantocid/ }))));

  // 2. Notes plus a photo of the prescription become one record.
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Consultation notes" }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Follow-up visit. Sugar better. Continue Gluconorm.");
  await page.locator("input[type=file]:not([capture])").setInputFiles("demo-docs/ravi/07-rx-ramesh-oct-2026-photo.jpg");
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  await page.getByRole("button", { name: "Save to my record" }).or(page.getByRole("link", { name: "Add another" })).first().waitFor({ timeout: 90000 });
  const { data: both } = await admin.from("documents").select("original_filename, file_hash").eq("patient_id", patient.id).like("original_filename", "Consultation notes (%");
  hashes.push(both?.[0]?.file_hash);
  check(`notes and photo kept as one record (${both?.[0]?.original_filename})`, both?.[0]?.original_filename === "Consultation notes (2 pages).pdf");

  // 3. A real handwritten prescription, if available on this machine.
  if (existsSync("/tmp/ct-tools/rx/rx.jpg")) {
    await page.goto(`${BASE}/upload`);
    await page.getByRole("radio", { name: "Prescription" }).click();
    await page.locator("input[type=file]:not([capture])").setInputFiles("/tmp/ct-tools/rx/rx.jpg");
    await page.getByRole("button", { name: "Upload record" }).click();
    await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
    check("handwritten prescription read (not 'could not read')", await seen(page.getByRole("heading", { name: "Check what we read" }), 90000));
    const hf = await page.locator("input[id^=freq-]").evaluateAll((els) => els.map((e) => e.value));
    check(`handwritten: medicines and how often read (${hf.length} medicines, ${hf.filter(Boolean).length} with a pattern)`, hf.length >= 5 && hf.filter(Boolean).length >= 3);
    const { data: hw } = await admin.from("documents").select("file_hash").eq("patient_id", patient.id).eq("type", "prescription");
    hashes.push(...(hw ?? []).map((d) => d.file_hash));
  }
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure-n.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  // Typed notes and real prescriptions are not kept in the extraction cache after the test.
  if (hashes.filter(Boolean).length) await admin.from("extraction_cache").delete().in("file_hash", hashes.filter(Boolean));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
