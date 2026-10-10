// "Try demo" and the public sample links, as a judge would use them.
// Usage: node --env-file=.env.local scripts/e2e/phase-h.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const started = new Date().toISOString();
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 45000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const b = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();

try {
  await a.goto(`${BASE}/`);
  await a.getByRole("link", { name: "Try the demo" }).click();
  check("landing 'Try the demo' leads to the sample patients", await seen(a.getByRole("button", { name: /Try as Ravi/ })));
  await a.screenshot({ path: `${shots}/landing-demo-desktop.png`, fullPage: true, caret: "initial" });
  await a.getByRole("button", { name: /Try as Ravi/ }).click();
  await a.waitForURL("**/home", { timeout: 60000 });
  check("Try demo logs straight into Ravi's record", await seen(a.getByRole("heading", { name: /Ravi$/ })));
  check("home shows the severe allergy warning", await seen(a.getByText("Mox may clash with your Penicillin allergy")));
  check("home shows Test Saver", await seen(a.getByText(/About ₹1,230/)));
  check("home shows latest results", await seen(a.getByText("Latest results")));
  await a.screenshot({ path: `${shots}/demo-home-desktop.png`, fullPage: true, caret: "initial" });

  await a.goto(`${BASE}/medicines`);
  check("duplicate metformin across two doctors", await seen(a.getByText("Metformin prescribed twice")));
  await a.goto(`${BASE}/records`);
  await a.locator("main ol > li").nth(9).waitFor({ timeout: 20000 }).catch(() => {});
  check("timeline lists the seeded records", (await a.locator("main ol > li").count()) === 10);
  await a.goto(`${BASE}/records/trends`);
  const hba1c = a.locator("section", { has: a.getByRole("heading", { name: "HbA1c", exact: true }) });
  await hba1c.getByText("Show all values").click();
  const values = await hba1c.locator("tbody tr td:nth-child(2)").allTextContents();
  check(`HbA1c trend from the real extraction (${values.map((v) => v.split(" ")[0]).join(", ")})`, values.length === 3 && /7\.4/.test(values[0]) && /6\.8/.test(values[2]));

  // A's share link must not appear in B's private copy.
  await a.goto(`${BASE}/sharing`);
  await a.locator("label", { hasText: "Everything" }).click();
  await a.getByRole("button", { name: "Create link" }).click();
  await a.getByText("Link ready").waitFor();
  await b.goto(`${BASE}/login`);
  await b.getByRole("button", { name: /Try as Ravi/ }).click();
  await b.waitForURL("**/home", { timeout: 60000 });
  await b.goto(`${BASE}/sharing`);
  check("each visitor gets a private copy (B sees no links from A)", await seen(b.getByText("No active links. Nobody can see your records right now.")));
  await b.goto(`${BASE}/home`);
  await b.getByText("Latest results").waitFor();
  await b.screenshot({ path: `${shots}/demo-home-mobile.png`, fullPage: true, caret: "initial" });

  // Sample doctor view and emergency card.
  const d = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await d.goto(`${BASE}/demo/doctor`);
  await d.getByLabel("Your name").fill("Dr. Judge");
  await d.getByRole("button", { name: "Open records" }).click();
  check("sample doctor's view opens Ravi's brief", await seen(d.getByRole("heading", { name: "Ravi Kumar" })));
  check("doctor sees the severe allergy clash", await seen(d.getByText(/may clash with the patient's Penicillin allergy/)));
  await d.screenshot({ path: `${shots}/demo-doctor-desktop.png`, fullPage: true, caret: "initial" });
  const e = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await e.goto(`${BASE}/demo/emergency`);
  check("sample emergency card opens Arun's card", await seen(e.getByRole("heading", { name: "Arun Prakash" })));
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await a.screenshot({ path: `${shots}/failure.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.user_metadata?.demo && u.email?.startsWith("demo-") && u.created_at >= started)) await admin.auth.admin.deleteUser(u.id);
  console.log(results.join("\n"));
}
