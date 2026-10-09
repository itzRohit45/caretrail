// Upload -> duplicate check -> AI extraction -> verify -> saved, in a real browser.
// Usage: node --env-file=.env.local scripts/e2e/phase-b.mjs   (dev server running, Gemini key set)
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phaseb-${Date.now()}@example.com`;
const password = "phase-b-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 45000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Ravi Kumar" } });
const userId = created.user.id;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function uploadFile(kind, path) {
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: kind }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(path);
  await page.getByRole("button", { name: "Upload record" }).click();
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  check("new user sees the first-record empty state", await seen(page.getByText("Add your first record")));

  await writeFile("/tmp/ct-big.pdf", Buffer.alloc(11 * 1024 * 1024));
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Lab report" }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles("/tmp/ct-big.pdf");
  check("file over 10 MB rejected before upload", await seen(page.getByText(/Files can be up to 10 MB/)));
  await writeFile("/tmp/ct-note.txt", "hello");
  await page.locator('input[type=file]:not([capture])').setInputFiles("/tmp/ct-note.txt");
  check("wrong file type rejected before upload", await seen(page.getByText(/is not a PDF, JPG or PNG/)));
  await page.screenshot({ path: `${shots}/upload-desktop.png`, fullPage: true, caret: "initial" });

  await uploadFile("Lab report", "demo-docs/ravi/08-lab-hba1c-sep-2026.pdf");
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 60000 });
  check("confident lab report saved without review", await seen(page.getByRole("heading", { name: "Test results" }), 60000));
  check("HbA1c value saved from the real extraction", await seen(page.getByText("Glycosylated Haemoglobin (HbA1c)")));
  await page.screenshot({ path: `${shots}/record-saved-desktop.png`, fullPage: true, caret: "initial" });

  await uploadFile("Lab report", "demo-docs/ravi/08-lab-hba1c-sep-2026.pdf");
  check("same file blocked as duplicate with date", await seen(page.getByText(/Already uploaded on/)));
  check("duplicate offers a link to the existing record", await seen(page.getByRole("link", { name: "Open it" })));

  await uploadFile("Prescription", "demo-docs/ravi/07-rx-ramesh-sep-2026-photo.jpg");
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 60000 });
  check("prescription goes to the verify screen", await seen(page.getByRole("heading", { name: "Check what we read" }), 60000));
  check("doses are flagged for checking", await seen(page.getByText("Check the dose and how often against your paper.")));
  check("brand mapped to its generic", await seen(page.getByText("metformin", { exact: true })));
  check("shorthand decoded for the patient", await seen(page.getByText("Morning and night")));
  await page.screenshot({ path: `${shots}/review-desktop.png`, fullPage: true, caret: "initial" });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.addCookies(await page.context().cookies());
  const m = await mobile.newPage();
  await m.goto(page.url());
  await m.getByRole("heading", { name: "Check what we read" }).waitFor();
  await m.screenshot({ path: `${shots}/review-mobile.png`, fullPage: true, caret: "initial" });
  await mobile.close();

  const dose = page.getByLabel("Dose").first();
  await dose.fill("500 mg");
  await page.getByRole("button", { name: "Save to my record" }).click();
  check("verified prescription saved", await seen(page.getByRole("heading", { name: "Medicines" }), 30000));
  check("edited medicine marked patient-verified", await seen(page.getByText("Patient-verified")));
  await page.screenshot({ path: `${shots}/record-rx-saved-desktop.png`, fullPage: true, caret: "initial" });

  await page.goto(`${BASE}/home`);
  check("home lists the saved records", (await page.getByRole("link", { name: /Ramesh Family Clinic|Sri Ram Diagnostics/ }).count()) >= 2);
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: pat } = await admin.from("patients").select("id").eq("owner_user_id", userId).maybeSingle();
  if (pat) {
    const { data: files } = await admin.storage.from("documents").list(pat.id);
    if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${pat.id}/${f.name}`));
  }
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
