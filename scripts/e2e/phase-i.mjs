// FR-12 break-glass: emergency page -> full record for 2 hours, logged as break_glass, patient told, revocable.
// Usage: node --env-file=.env.local scripts/e2e/phase-i.mjs
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasei-${Date.now()}@example.com`;
const password = "phase-i-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

// A private copy of Arun (full record), exactly as "Try as Arun" makes it, plus an emergency QR.
const { data: template } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", "Arun Prakash").single();
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true, name: "Arun Prakash" } });
const userId = created.user.id;
await admin.rpc("clone_demo_patient", { p_template: template.id, p_owner: userId });
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
const token = randomBytes(32).toString("base64url");
await admin.from("patients").update({ emergency_token_hash: createHash("sha256").update(token).digest("hex"), emergency_token_created_at: new Date().toISOString() }).eq("id", patient.id);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const er = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await er.goto(`${BASE}/e#${token}`);
  await er.getByRole("heading", { name: "Arun Prakash" }).waitFor();
  check("tier 1 offers 'Request full record'", await seen(er.getByRole("button", { name: "Request full record" })));
  await er.getByRole("button", { name: "Request full record" }).click();
  await er.getByLabel("Your name").fill("Dr Kavya Rao");
  await er.getByLabel("Hospital or ambulance service").fill("Apollo Emergency, Greams Road");
  await er.getByRole("button", { name: "Open full record for 2 hours" }).click();
  check("missing registration number refused", await seen(er.getByText("Enter your medical registration number.")));
  check("typed name kept after the error", (await er.getByLabel("Your name").inputValue()) === "Dr Kavya Rao");
  await er.screenshot({ path: `${shots}/break-glass-form-mobile.png`, fullPage: true, caret: "initial" });
  await er.getByLabel("Medical registration number").fill("TNMC 84213");
  await er.getByRole("button", { name: "Open full record for 2 hours" }).click();
  await er.waitForURL(/\/s#[A-Za-z0-9_-]{43}$/, { timeout: 30000 });
  check("full record opens without typing the name again", await seen(er.getByText("Viewing as")));
  check("doctor told the access is logged and alerted", await seen(er.getByText(/Emergency full access\. Your name, hospital and registration number are recorded/)));
  check("full scope: all records shown", await seen(er.getByText("All records")));
  check("full record shows conditions panel", await seen(er.getByRole("heading", { name: /Conditions/ })));
  await er.screenshot({ path: `${shots}/break-glass-doctor-mobile.png`, fullPage: true, caret: "initial" });

  const { data: links } = await admin.from("share_links").select("id, is_break_glass, scope_type, created_at, expires_at").eq("patient_id", patient.id);
  const link = links?.find((l) => l.is_break_glass);
  const hours = link ? (new Date(link.expires_at) - new Date(link.created_at)) / 3600000 : 0;
  check(`break-glass link: full scope for 2 hours (${hours.toFixed(2)} h)`, link?.scope_type === "all" && Math.abs(hours - 2) < 0.01);
  const { data: logs } = await admin.from("access_logs").select("action, viewer_name, viewer_hospital, viewer_reg_no").eq("patient_id", patient.id).eq("action", "break_glass");
  check("logged as break_glass with hospital and registration number", logs?.length === 1 && logs[0].viewer_reg_no === "TNMC 84213" && logs[0].viewer_hospital === "Apollo Emergency, Greams Road");
  const { error: delError } = await admin.from("access_logs").delete().eq("patient_id", patient.id).eq("action", "break_glass");
  const { data: still } = await admin.from("access_logs").select("id").eq("patient_id", patient.id).eq("action", "break_glass");
  check("break-glass entry cannot be deleted, even with the service key", Boolean(delError) && still?.length === 1);

  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  check("patient sees the emergency access on Home", await seen(page.getByText(/Emergency full access opened by Dr Kavya Rao, Apollo Emergency/)));
  await page.screenshot({ path: `${shots}/break-glass-home-desktop.png`, fullPage: true, caret: "initial" });
  await page.goto(`${BASE}/sharing/history`);
  check("access history flags it", await seen(page.getByText("Dr Kavya Rao used emergency full access")));
  await page.goto(`${BASE}/sharing`);
  check("sharing lists it as emergency full access", await seen(page.getByText("Emergency full access", { exact: true })));
  const card = page.locator("li").filter({ hasText: "Emergency full access" });
  await card.getByRole("button", { name: "End access" }).click();
  const start = Date.now();
  await page.getByRole("button", { name: "Yes, end access" }).click();
  const ended = await seen(er.getByText("Access ended"), 10000);
  check(`patient can end it; doctor sees Access ended (${((Date.now() - start) / 1000).toFixed(1)} s)`, ended);
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await er.screenshot({ path: `${shots}/failure-i.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
