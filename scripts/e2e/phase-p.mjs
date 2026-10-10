// Alert centre: Home shows at most two dismissible alerts; the bell panel lists every alert (new, then seen).
// Usage: node --env-file=.env.local scripts/e2e/phase-p.mjs
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasep-${Date.now()}@example.com`;
const password = "phase-p-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Rohit Test" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
// Events that create alerts: an emergency scan, emergency full access and a doctor's note.
await admin.from("access_logs").insert([
  { patient_id: patient.id, action: "emergency_scan" },
  { patient_id: patient.id, action: "break_glass", viewer_name: "Dr Sarvan Kumar", viewer_hospital: "City Hospital", viewer_reg_no: "TNMC 11111" },
]);
const { data: link } = await admin.from("share_links").insert({ patient_id: patient.id, token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"), scope_type: "all", expires_at: new Date(Date.now() + 3600000).toISOString(), allow_write_back: true }).select("id").single();
await admin.from("doctor_notes").insert({ share_link_id: link.id, patient_id: patient.id, doctor_name: "Dr. Meena Raghavan", note: "Continue Glycomet. Repeat HbA1c in 3 months." });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
async function upload(path, save) {
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Prescription" }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles(path);
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  await page.getByRole("button", { name: "Save to my record" }).waitFor({ timeout: 90000 });
  if (save) {
    await page.getByRole("button", { name: "Save to my record" }).click();
    await page.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });
  }
}
try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  await upload("demo-docs/overlap-test/rx-1-sunrise-clinic-oct-2026.pdf", true);
  await upload("demo-docs/overlap-test/rx-2-lotus-centre-oct-2026-photo.jpg", true);
  await upload("demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg", false); // left waiting for the check

  await page.goto(`${BASE}/home`);
  const banners = page.locator("section[aria-label=Alerts] > div");
  await banners.first().waitFor();
  check(`Home shows at most two alerts (${await banners.count()})`, (await banners.count()) === 2);
  check("most serious first: emergency full access", /Emergency full access opened by Dr Sarvan Kumar/.test(await banners.first().innerText()));
  check("the rest are behind 'View all alerts'", await seen(page.getByRole("button", { name: /View all alerts \(4\)/ })));
  check("medicine card is compact: the major interaction by name", await seen(page.getByText("Major interaction: Clopilet and Omez")) && (await seen(page.getByText(/more to discuss with your doctor/))));
  await page.screenshot({ path: `${shots}/alerts-home-mobile.png`, fullPage: false, caret: "initial" });

  check("bell shows the number of new alerts (5)", await seen(page.getByRole("button", { name: "Alerts, 5 new" }), 15000));
  await page.getByRole("button", { name: /View all alerts/ }).click();
  const panel = page.getByRole("dialog", { name: "Alerts" });
  check("panel opens with every alert", await seen(panel.getByText("Note from Dr. Meena Raghavan")) && (await seen(panel.getByText(/records? needs? your check/))) && (await seen(panel.getByText(/medicine warnings/))));
  await page.screenshot({ path: `${shots}/alerts-panel-mobile.png`, fullPage: false, caret: "initial" });
  await page.keyboard.press("Escape");
  check("Escape closes the panel", (await panel.count()) === 0);

  await banners.first().getByRole("button", { name: /^Dismiss:/ }).click();
  check("dismissed alert leaves Home", !(/Emergency full access/.test(await page.locator("section[aria-label=Alerts]").innerText())));
  await page.reload();
  await page.locator("section[aria-label=Alerts] > div").first().waitFor();
  check("still dismissed after reload", !(/Emergency full access/.test(await page.locator("section[aria-label=Alerts]").innerText())));
  check("bell count went down", await seen(page.getByRole("button", { name: "Alerts, 4 new" }), 15000));
  await page.getByRole("button", { name: /^Alerts/ }).click();
  check("dismissed alert kept in the panel under Seen", await seen(page.getByRole("dialog").locator("section[aria-label=Seen]").getByText(/Emergency full access/)));
  await page.getByRole("dialog").getByRole("button", { name: "Dismiss all" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  check("Dismiss all clears the badge", (await page.getByRole("button", { name: "Alerts", exact: true }).count()) === 1);
  await page.reload();
  check("Home has no alert banners after Dismiss all", (await page.locator("section[aria-label=Alerts]").count()) === 0);
  check("medicine warnings stay on Home (safety)", await seen(page.getByText(/medicine warnings/)));

  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await desk.goto(`${BASE}/login`);
  await desk.getByLabel("Email").fill(email);
  await desk.getByLabel("Password").fill(password);
  await desk.getByRole("button", { name: "Log in" }).click();
  await desk.waitForURL("**/home");
  await desk.getByRole("button", { name: /^Alerts/ }).click();
  await desk.getByRole("dialog").waitFor();
  await desk.screenshot({ path: `${shots}/alerts-panel-desktop.png`, caret: "initial" });
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure-p.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
