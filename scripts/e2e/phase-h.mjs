// The dedicated test account (npm run seed:test-account): every card shows the uploaded sample records.
// Read-only except for one share link it creates and ends. Usage: node --env-file=.env.local scripts/e2e/phase-h.mjs
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const a = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let linkId = null;
try {
  await a.goto(`${BASE}/`);
  check("landing has no demo panel", (await a.getByText(/Try as Ravi|Try the demo/).count()) === 0);
  await a.goto(`${BASE}/login`);
  await a.getByLabel("Email").fill("caretrail.test@example.com");
  await a.getByLabel("Password").fill("CareTrail@2026");
  await a.getByRole("button", { name: "Log in" }).click();
  await a.waitForURL("**/home");
  check("test account logs in", await seen(a.getByRole("heading", { name: /Ravi$/ })));
  check("home shows the severe allergy clash", await seen(a.getByText("Mox may clash with your Penicillin allergy")));
  check("home shows Tests still valid with an estimate", await seen(a.getByText(/About ₹[\d,]+/)));
  check("home shows latest results from uploads", await seen(a.getByText("Latest results")) && (await seen(a.getByText("7.4", { exact: false }))));
  await a.screenshot({ path: `${shots}/test-account-home-desktop.png`, fullPage: true, caret: "initial" });

  await a.goto(`${BASE}/medicines`);
  check("duplicate metformin across two doctors", await seen(a.getByText("Metformin prescribed twice")));
  check("finished courses moved out of Taking now", await seen(a.getByText(/Finished courses|Stopped medicines/)));
  await a.goto(`${BASE}/records`);
  await a.locator("main ol > li").nth(9).waitFor({ timeout: 20000 }).catch(() => {});
  check(`timeline lists all 10 uploaded records (${await a.locator("main ol > li").count()})`, (await a.locator("main ol > li").count()) === 10);
  await a.goto(`${BASE}/records/trends`);
  const hba1c = a.locator("section", { has: a.getByRole("heading", { name: "HbA1c", exact: true }) });
  await hba1c.getByText("Show all values").click();
  const values = await hba1c.locator("tbody tr td:nth-child(2)").allTextContents();
  check(`HbA1c trend from the real extraction (${values.map((v) => v.split(" ")[0]).join(", ")})`, values.length === 3 && /7\.4/.test(values[0]) && /6\.8/.test(values[2]));

  // A doctor opens a link to the full record, then the link is ended.
  const share = await a.evaluate(() => fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "phase-h check", scope_type: "all", expires_in: "1h" }) }).then((r) => r.json()));
  linkId = share.data.id;
  const d = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await d.goto(share.data.url);
  await d.getByLabel("Your name").fill("Dr. Check");
  await d.getByRole("button", { name: "Open records" }).click();
  check("doctor's view opens the test account's brief", await seen(d.getByRole("heading", { name: "Ravi Kumar" })));
  check("doctor sees the severe allergy clash", await seen(d.getByText(/may clash with the patient's Penicillin allergy/)));
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  if (linkId) await a.evaluate((id) => fetch(`/api/shares/${id}/revoke`, { method: "POST" }), linkId).catch(() => {});
  await browser.close();
  console.log(results.join("\n"));
}
