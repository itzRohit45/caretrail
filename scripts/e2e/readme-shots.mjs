// Screenshots for README.md (.github/readme/screenshots). Test account read-only (links it makes are ended);
// a temporary account for uploads, the emergency card and alerts. Usage: E2E_BASE_URL=... node --env-file=.env.local scripts/e2e/readme-shots.mjs
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const out = ".github/readme/screenshots";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const desktop = () => browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 }).then((c) => c.newPage());
const phone = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).then((c) => c.newPage());
const settle = (p) => p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}).then(() => p.waitForTimeout(600));
const links = [];
async function login(p, email, password) {
  await p.goto(`${BASE}/login`);
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: "Log in" }).click();
  await p.waitForURL("**/home");
}
async function upload(p, kind, path, save = true) {
  await p.goto(`${BASE}/upload`);
  await p.getByRole("radio", { name: kind }).click();
  await p.locator("input[type=file]:not([capture])").setInputFiles(path);
  await p.getByRole("button", { name: "Upload record" }).click();
  await p.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  const review = p.getByRole("button", { name: "Save to my record" });
  const saved = p.getByRole("link", { name: "Add another" });
  await Promise.race([review.waitFor({ timeout: 90000 }), saved.waitFor({ timeout: 90000 })]);
  if (save && (await review.isVisible())) {
    await review.click();
    await saved.waitFor({ timeout: 30000 });
  }
}
async function share(p, body) {
  const r = await p.evaluate((b) => fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((x) => x.json()), body);
  links.push(r.data.id);
  return r.data;
}
async function doctor(url, name, reg) {
  const d = await desktop();
  await d.goto(url);
  await d.getByLabel("Your name").fill(name);
  if (reg) await d.getByLabel(/Registration number/).fill(reg);
  await d.getByRole("button", { name: "Open records" }).click();
  await d.getByText("Viewing as").waitFor({ timeout: 30000 });
  await settle(d);
  return d;
}

const email = `shots-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url");
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Ravi Kumar" } });
const { data: tmp } = await admin.from("patients").select("id").eq("owner_user_id", created.user.id).single();
const eToken = randomBytes(32).toString("base64url");
await admin.from("patients").update({ dob: "1971-03-14", sex: "male", blood_group: "B+", emergency_contact_name: "Priya Kumar", emergency_contact_phone: "+91 98450 31267", emergency_token_hash: createHash("sha256").update(eToken).digest("hex"), emergency_token_created_at: new Date().toISOString() }).eq("id", tmp.id);
await admin.from("allergies").insert({ patient_id: tmp.id, substance: "Penicillin", severity: "severe", reaction: "Rash and swelling" });

try {
  // Landing.
  const l = await desktop();
  await l.goto(`${BASE}/`);
  await settle(l);
  await l.screenshot({ path: `${out}/landing.png` });

  // Test account: Home, Medicines, Trends, Sharing, doctor brief with a highlighted source.
  const a = await desktop();
  await login(a, "caretrail.test@example.com", "CareTrail@2026");
  await settle(a);
  await a.screenshot({ path: `${out}/home.png` });
  await a.goto(`${BASE}/medicines`);
  await settle(a);
  await a.screenshot({ path: `${out}/medicines.png` });
  await a.goto(`${BASE}/records/trends`);
  await settle(a);
  await a.locator("section", { has: a.getByRole("heading", { name: "HbA1c", exact: true }) }).screenshot({ path: `${out}/trends.png` });
  await a.goto(`${BASE}/sharing`);
  await a.getByLabel("Who is it for?").fill("Dr. Meena, diabetes clinic");
  await a.locator("label", { hasText: "Diabetes" }).first().click();
  await a.getByText("Ask the doctor for a code").click();
  const [resp] = await Promise.all([a.waitForResponse((r) => r.url().endsWith("/api/shares") && r.request().method() === "POST"), a.getByRole("button", { name: "Create link" }).click()]);
  const link = (await resp.json()).data;
  links.push(link.id);
  await a.getByRole("img", { name: "QR code for the doctor to scan" }).waitFor();
  await a.locator("section", { has: a.getByRole("img", { name: "QR code for the doctor to scan" }) }).screenshot({ path: `${out}/sharing.png` });
  const full = await share(a, { label: "README", scope_type: "all", expires_in: "1h" });
  const d = await doctor(full.url, "Dr. Meena Raghavan", null);
  await d.screenshot({ path: `${out}/doctor-brief.png` });
  await d.getByRole("button", { name: /^HbA1c\. Open source/ }).first().click();
  await d.getByRole("dialog").waitFor();
  await d.waitForTimeout(4000);
  await d.screenshot({ path: `${out}/doctor-source.png` });

  // Temporary account: check screen, since-last-visit, emergency card, alerts.
  const t = await desktop();
  await login(t, email, password);
  await upload(t, "Prescription", "demo-docs/ravi/06-rx-suresh-aug-2026.pdf");
  const tl = await share(t, { label: "Diabetes clinic", scope_type: "all", expires_in: "1h" });
  (await doctor(tl.url, "Dr. A. Suresh", "TNMC 48213")).context().close();
  await upload(t, "Lab report", "demo-docs/ravi/08-lab-hba1c-oct-2026.pdf");
  await upload(t, "Prescription", "demo-docs/ravi/10-rx-lakshmanan-oct-2026.pdf");
  await upload(t, "Prescription", "demo-docs/ravi/07-rx-ramesh-oct-2026-photo.jpg");
  const s = await doctor(tl.url, "Dr. A. Suresh", "TNMC 48213");
  await s.screenshot({ path: `${out}/since-last-visit.png` });
  await upload(t, "Prescription", "demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg", false);
  await t.getByRole("button", { name: /Show the document/ }).click().catch(() => {});
  await settle(t);
  await t.screenshot({ path: `${out}/check-screen.png` });

  const e = await phone();
  await e.goto(`${BASE}/e#${eToken}`);
  await e.getByRole("heading", { name: "Ravi Kumar" }).waitFor();
  await settle(e);
  await e.screenshot({ path: `${out}/emergency-card.png` });

  await admin.from("access_logs").insert({ patient_id: tmp.id, action: "break_glass", viewer_name: "Dr Kavya Rao", viewer_hospital: "Apollo Emergency", viewer_reg_no: "TNMC 84213" });
  const m = await phone();
  await login(m, email, password);
  await settle(m);
  await m.screenshot({ path: `${out}/home-alerts-mobile.png` });
  await m.getByRole("button", { name: /^Alerts/ }).click();
  await m.getByRole("dialog", { name: "Alerts" }).getByText(/medicine warnings/).waitFor();
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${out}/alerts-panel-mobile.png` });
  console.log("screenshots written to", out);
} finally {
  await browser.close();
  if (links.length) await admin.from("share_links").update({ revoked_at: new Date().toISOString() }).in("id", links);
  const { data: files } = await admin.storage.from("documents").list(tmp.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${tmp.id}/${f.name}`));
  await admin.auth.admin.deleteUser(created.user.id);
}
