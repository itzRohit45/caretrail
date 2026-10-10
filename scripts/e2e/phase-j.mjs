// FR-13 since-last-visit, as it happens for real: a doctor views, the patient adds records, the same
// doctor (name + registration number) returns and sees only what is new.
// Usage: node --env-file=.env.local scripts/e2e/phase-j.mjs
import { randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasej-${Date.now()}@example.com`;
const password = randomBytes(18).toString("base64url");
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
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  const review = page.getByRole("button", { name: "Save to my record" });
  const saved = page.getByRole("link", { name: "Add another" });
  await Promise.race([review.waitFor({ timeout: 90000 }), saved.waitFor({ timeout: 90000 })]);
  if (await review.isVisible()) {
    await review.click();
    await saved.waitFor({ timeout: 30000 });
  }
}
async function openAs(url, name, reg, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.getByLabel("Your name").fill(name);
  if (reg) await p.getByLabel(/Registration number/).fill(reg);
  await p.getByRole("button", { name: "Open records" }).click();
  await p.getByText("Viewing as").waitFor({ timeout: 30000 });
  return p;
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  await addRecord("Prescription", "demo-docs/ravi/06-rx-suresh-aug-2026.pdf");
  const share = await page.evaluate(() => fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Diabetes clinic", scope_type: "all", expires_in: "1h" }) }).then((r) => r.json()));

  // 1. First visit: nothing to compare with.
  const v1 = await openAs(share.data.url, "Dr. A. Suresh", "TNMC 61234");
  check("first visit shows the full brief only", (await v1.getByText(/Since your last view|Nothing new since/).count()) === 0 && (await seen(v1.getByRole("heading", { name: /Key results|Current medicines/ }))));
  await v1.context().close();

  // 2. The patient adds a new prescription (a penicillin antibiotic) and a lab report.
  await addRecord("Prescription", "demo-docs/ravi/10-rx-lakshmanan-oct-2026.pdf");
  await addRecord("Lab report", "demo-docs/ravi/08-lab-hba1c-oct-2026.pdf");

  // 3. Same doctor returns, name and number written differently.
  const v2 = await openAs(share.data.url, "dr a suresh", "tnmc-61234");
  check("returning doctor matched and opens on 'Since your last view'", await seen(v2.getByRole("button", { name: /Since your last view/, pressed: true })));
  check("new prescription listed: Mox started", await seen(v2.getByText(/Started Mox/)));
  check("new allergy clash under new warnings", await seen(v2.locator("section", { has: v2.getByRole("heading", { name: /New warnings/ }) }).getByText(/Mox/)));
  check("new HbA1c result listed", await seen(v2.locator("section", { has: v2.getByRole("heading", { name: /New results/ }) }).getByText("HbA1c")));
  check("medicines from the first visit not repeated (Glycomet)", (await v2.getByText("Started Glycomet").count()) === 0);
  await v2.screenshot({ path: `${shots}/since-last-visit-desktop.png`, fullPage: true, caret: "initial" });
  await v2.getByRole("button", { name: "Full brief" }).click();
  check("Full brief one tap away", await seen(v2.getByRole("heading", { name: /Key results/ })));
  await v2.context().close();

  // 4. Straight after: nothing new.
  const v3 = await openAs(share.data.url, "Dr. A. Suresh", "TNMC 61234", 390);
  check("visit right after: nothing new since the last view", await seen(v3.getByText(/Nothing new since your last view/)));
  await v3.context().close();

  // 5. A different doctor without a number: full brief only.
  const v4 = await openAs(share.data.url, "Dr. Meera Iyer", null);
  check("new doctor without a number gets the full brief only", (await v4.getByText(/Since your last view|Nothing new since/).count()) === 0);
  await v4.context().close();
  const { data: logs } = await admin.from("access_logs").select("viewer_reg_no").eq("patient_id", patient.id).eq("action", "opened");
  check("registration number recorded in the access log", logs?.filter((l) => l.viewer_reg_no).length === 3);
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
