// Sharing security and the source-linked brief, patient and doctor in separate browsers.
// Usage: node --env-file=.env.local scripts/e2e/phase-ef.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasee-${Date.now()}@example.com`;
const password = "phase-e-pass-123";
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
await admin.from("patients").update({ dob: "1971-03-14", sex: "male", blood_group: "B+" }).eq("id", patient.id);
await admin.from("allergies").insert({ patient_id: patient.id, substance: "Penicillin", severity: "severe", reaction: "Rash" });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const docCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const doc = await docCtx.newPage();
doc.on("console", (m) => m.type() === "error" && console.log("[doctor console]", m.text().slice(0, 300)));

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
  for (const [kind, file] of [
    ["Prescription", "demo-docs/ravi/06-rx-suresh-aug-2026.pdf"],
    ["Lab report", "demo-docs/ravi/08-lab-hba1c-oct-2026.pdf"],
    ["Lab report", "demo-docs/ravi/04-lab-lipid-mar-2026.pdf"],
  ]) await addRecord(kind, file);

  // Patient: diabetes-only, 1 hour, with a code.
  await page.goto(`${BASE}/sharing`);
  await page.getByLabel("Who is it for?").fill("Dr. Meena, diabetes clinic");
  await page.locator("label", { hasText: "Diabetes" }).first().click();
  await page.locator("label", { hasText: "1 hour" }).click();
  await page.getByText("Ask the doctor for a code").click();
  const [resp] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/shares") && r.request().method() === "POST"), page.getByRole("button", { name: "Create link" }).click()]);
  const share = (await resp.json()).data;
  check("link created once with QR and code", await seen(page.getByRole("img", { name: "QR code for the doctor to scan" })) && /^\d{6}$/.test(share.otp_code));
  check("token travels in the URL fragment", /\/s#[A-Za-z0-9_-]{43}$/.test(share.url));
  const { data: stored } = await admin.from("share_links").select("token_hash").eq("id", share.id).single();
  check("only the SHA-256 of the token is stored", /^[a-f0-9]{64}$/.test(stored.token_hash) && !share.url.includes(stored.token_hash));
  await page.screenshot({ path: `${shots}/share-created-desktop.png`, fullPage: true, caret: "initial" });
  const token = share.url.split("#")[1];
  const url = `${BASE}/s#${token}`;

  // Doctor: wrong code, then right code.
  await doc.goto(url);
  check("doctor is asked for name and code", await seen(doc.getByLabel("Code from the patient")));
  await doc.screenshot({ path: `${shots}/doctor-gate.png`, caret: "initial" });
  await doc.getByLabel("Your name").fill("Dr. Meena Raghavan");
  await doc.getByLabel("Code from the patient").fill(share.otp_code === "000000" ? "111111" : "000000");
  await doc.getByRole("button", { name: "Open records" }).click();
  check("wrong code refused", await seen(doc.getByText(/does not match/)));
  await doc.getByLabel("Code from the patient").fill(share.otp_code);
  await doc.getByRole("button", { name: "Open records" }).click();
  check("brief opens with patient header", await seen(doc.getByRole("heading", { name: "Ravi Kumar" })));
  check("scope shown to the doctor", await seen(doc.getByText("Diabetes only")));
  check("allergy always included", await seen(doc.getByText("Penicillin")));
  check("in-scope medicine shown (Glycomet)", await seen(doc.getByText("Glycomet", { exact: false })));
  check("out-of-scope medicines hidden (Telma, Atorva)", (await doc.getByText(/Telma|Atorva/).count()) === 0);
  check("out-of-scope lipid report hidden", (await doc.getByText("Lister Labs").count()) === 0);
  check("recent HbA1c flagged for re-ordering", await seen(doc.getByText("Recent, consider before re-ordering")));
  await doc.screenshot({ path: `${shots}/doctor-brief-desktop.png`, fullPage: true, caret: "initial" });

  await doc.getByRole("button", { name: /^HbA1c\. Open source/ }).click();
  check("source document opens with the text highlighted", await seen(doc.getByText("Highlighted on the page."), 30000));
  await doc.screenshot({ path: `${shots}/doctor-source.png`, caret: "initial" });
  await doc.getByRole("button", { name: "Close" }).click();

  // Patient sees the live viewer.
  await page.goto(`${BASE}/sharing`);
  check("patient sees who is viewing now", await seen(page.getByText(/Dr\. Meena Raghavan is viewing now/), 20000));

  // Doctor edits the URL to reach an out-of-scope document.
  const { data: lipid } = await admin.from("documents").select("id").eq("patient_id", patient.id).eq("facility", "Lister Labs").single();
  await doc.goto(`${BASE}/s?doc=${lipid.id}#${token}`);
  check("out-of-scope document refused", await seen(doc.getByText("Outside what was shared")));
  await doc.getByRole("button", { name: "Close" }).click();

  // Patient revokes while the doctor is viewing; measure how fast the doctor's page ends.
  await page.getByRole("button", { name: "End access" }).click();
  const t0 = Date.now();
  await page.getByRole("button", { name: "Yes, end access" }).click();
  const ended = await seen(doc.getByRole("heading", { name: "Access ended" }), 15000);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  check(`doctor screen shows Access ended after revoke (${secs} s)`, ended && Number(secs) <= 6.5);
  check("patient data cleared from the doctor's page", (await doc.getByText("Glycomet").count()) === 0);

  // Same generic 410 for revoked and unknown tokens.
  const probe = async (t) => doc.evaluate(async (tk) => { const r = await fetch("/api/s/status", { headers: { "x-share-token": tk } }); return `${r.status} ${JSON.stringify(await r.json())}`; }, t);
  const revoked = await probe(token);
  const unknown = await probe("A".repeat(43));
  check("revoked and unknown tokens get the same 410 body", revoked === unknown && revoked.startsWith("410"));

  // History records each step.
  await page.goto(`${BASE}/sharing/history`);
  for (const text of ["entered a wrong code", "opened your records", "viewed a document", "tried to open something you did not share"]) {
    check(`access history: "${text}"`, await seen(page.getByText(text, { exact: false })));
  }
  await page.screenshot({ path: `${shots}/access-history-desktop.png`, fullPage: true, caret: "initial" });

  // Rate limit on token routes.
  const statuses = await doc.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 65; i++) out.push((await fetch("/api/s/status", { headers: { "x-share-token": "B".repeat(43) } })).status);
    return out;
  });
  check("repeated bad tokens get 429", statuses.includes(429));
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await doc.screenshot({ path: `${shots}/failure-doctor.png`, fullPage: true, caret: "initial" }).catch(() => {});
  await page.screenshot({ path: `${shots}/failure.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
