// Medicines, cross-prescriber safety checks and Test Saver, on documents run through the real pipeline.
// Usage: node --env-file=.env.local scripts/e2e/phase-d.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phased-${Date.now()}@example.com`;
const password = "phase-d-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Ravi Kumar" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
await admin.from("allergies").insert({ patient_id: patient.id, substance: "Penicillin", severity: "severe", reaction: "Rash" });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function addRecord(kind, path) {
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: kind }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles(path);
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const review = page.getByRole("button", { name: "Save to my record" });
  const saved = page.getByRole("link", { name: "Add another" });
  await Promise.race([review.waitFor({ timeout: 60000 }), saved.waitFor({ timeout: 60000 })]);
  if (await review.isVisible()) {
    await review.click();
    await saved.waitFor({ timeout: 30000 });
  }
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  check("empty medicines state before any prescription", await (async () => { await page.goto(`${BASE}/medicines`); return seen(page.getByText("No medicines yet")); })());

  for (const [kind, file] of [
    ["Prescription", "demo-docs/ravi/06-rx-suresh-aug-2026.pdf"],
    ["Prescription", "demo-docs/ravi/07-rx-ramesh-sep-2026-photo.jpg"],
    ["Prescription", "demo-docs/ravi/10-rx-lakshmanan-sep-2026.pdf"],
    ["Lab report", "demo-docs/ravi/08-lab-hba1c-sep-2026.pdf"],
  ]) await addRecord(kind, file);

  await page.goto(`${BASE}/medicines`);
  check("severe allergy clash for the penicillin-class antibiotic", await seen(page.getByText(/may clash with your Penicillin allergy/)));
  check("allergy warning names the prescribing doctor", await seen(page.getByText(/Prescribed by Dr\. S\. Lakshmanan/)));
  check("duplicate metformin warning", await seen(page.getByText("Metformin prescribed twice")));
  const dup = await page.getByText(/(both|all) contain metformin/).first().textContent();
  check("duplicate warning names both doctors", /Suresh/.test(dup ?? "") && /Ramesh/.test(dup ?? ""));
  check("moderate interaction listed", await seen(page.getByText(/moderate interaction/i)));
  check("fixed safety note shown", await seen(page.getByText("Discuss with your doctor; do not stop medicines on your own.")));
  check("ended course prompts to mark stopped", await seen(page.getByText(/This course was written to end on/)));
  await page.screenshot({ path: `${shots}/medicines-desktop.png`, fullPage: true, caret: "initial" });

  const api = await page.evaluate(async () => (await fetch("/api/safety")).json());
  check("GET /api/safety returns the warnings as data", Array.isArray(api.data?.warnings) && api.data.warnings.some((w) => w.kind === "allergy" && w.level === "severe"));

  const gluconorm = page.locator("li").filter({ hasText: "Gluconorm" }).filter({ has: page.getByRole("button", { name: "Mark as stopped" }) });
  await gluconorm.getByRole("button", { name: "Mark as stopped" }).click();
  await page.getByRole("button", { name: "Yes, mark stopped" }).click();
  await page.getByText("Metformin prescribed twice").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  check("stopping one brand clears the duplicate warning", (await page.getByText("Metformin prescribed twice").count()) === 0);
  check("stopped medicine kept in history", await seen(page.getByText(/Stopped medicines \(1\)/)));

  await page.goto(`${BASE}/home`);
  check("home shows medicine warnings at the top", await seen(page.getByText(/medicine warning/)));
  check("home shows the Test Saver estimate", await seen(page.getByText(/About ₹/)));
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.addCookies(await page.context().cookies());
  const mp = await m.newPage();
  await mp.goto(`${BASE}/medicines`);
  await mp.getByText("Safety checks").waitFor();
  await mp.screenshot({ path: `${shots}/medicines-mobile.png`, fullPage: true, caret: "initial" });
  await mp.goto(`${BASE}/home`);
  await mp.getByText(/medicine warning/).first().waitFor();
  await mp.screenshot({ path: `${shots}/home-safety-mobile.png`, fullPage: true, caret: "initial" });
  await m.close();
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
