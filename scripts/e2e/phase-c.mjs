// Timeline, filters and lab trends on a realistic record built through the real pipeline.
// Usage: node --env-file=.env.local scripts/e2e/phase-c.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasec-${Date.now()}@example.com`;
const password = "phase-c-pass-123";
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
    ["Lab report", "demo-docs/ravi/01-lab-hba1c-nov-2025.pdf"],
    ["Prescription", "demo-docs/ravi/02-rx-suresh-nov-2025.pdf"],
    ["Discharge summary", "demo-docs/ravi/03-discharge-kaveri-mar-2026.pdf"],
    ["Lab report", "demo-docs/ravi/04-lab-lipid-mar-2026.pdf"],
    ["Lab report", "demo-docs/ravi/08-lab-hba1c-sep-2026.pdf"],
    ["Lab report", "demo-docs/ravi/09-lab-fbs-medall-sep-2026.pdf"],
  ]) {
    await addRecord(kind, file);
  }
  check("six documents added through the real pipeline", true);

  await page.goto(`${BASE}/records`);
  const firstMonth = await page.locator("main h2").first().textContent();
  check(`newest month first (got "${firstMonth}")`, /September 2026/.test(firstMonth ?? ""));
  check("two labs on the same day both shown", (await page.getByRole("link", { name: /Sri Ram Diagnostics|Medall Diagnostics/ }).count()) >= 3);
  await page.screenshot({ path: `${shots}/timeline-desktop.png`, fullPage: true, caret: "initial" });

  await page.getByRole("link", { name: "Thyroid", exact: true }).click();
  check("thyroid filter shows the no-match state", await seen(page.getByText("No records match")));
  await page.getByRole("link", { name: "Diabetes", exact: true }).click();
  await page.waitForURL(/condition=diabetes/);
  check("diabetes filter keeps diabetes records", (await page.locator("main ol > li").count()) >= 4);
  await page.getByRole("link", { name: "Prescription", exact: true }).click();
  await page.waitForURL(/type=prescription/);
  check("type filter narrows to prescriptions", (await page.locator("main ol > li").count()) === 1);

  await page.goto(`${BASE}/records/trends`);
  const hba1c = page.locator("section", { has: page.getByRole("heading", { name: "HbA1c", exact: true }) });
  check("HbA1c chart rendered", await seen(hba1c.locator(".recharts-line")));
  await hba1c.getByText("Show all values").click();
  check("HbA1c has three results (6.8, 7.1, 7.4)", (await hba1c.locator("tbody tr").count()) === 3);
  check("latest HbA1c and change shown", await seen(hba1c.getByText(/Up 0\.3 %/)));
  const fbs = page.locator("section", { has: page.getByRole("heading", { name: "Fasting glucose", exact: true }) });
  await fbs.getByText("Show all values").click();
  check("same-day fasting values from two labs both charted", (await fbs.locator("tbody tr", { hasText: "19 Sept 2026" }).count()) === 2);
  check("charts with no data show a helpful empty state", await seen(page.getByText(/No TSH results yet/)));
  await page.screenshot({ path: `${shots}/trends-desktop.png`, fullPage: true, caret: "initial" });
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.addCookies(await page.context().cookies());
  const mp = await m.newPage();
  await mp.goto(`${BASE}/records/trends`);
  await mp.locator(".recharts-line").first().waitFor();
  await mp.screenshot({ path: `${shots}/trends-mobile.png`, fullPage: true, caret: "initial" });
  await mp.goto(`${BASE}/records`);
  await mp.screenshot({ path: `${shots}/timeline-mobile.png`, fullPage: true, caret: "initial" });
  await mp.goto(`${BASE}/home`);
  await mp.getByText("Latest results").waitFor();
  await mp.screenshot({ path: `${shots}/home-data-mobile.png`, fullPage: true, caret: "initial" });
  await m.close();

  await hba1c.getByRole("link", { name: "Open" }).first().click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/);
  check("a trend value opens its source report", await seen(page.getByText("Sri Ram Diagnostics")));
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
