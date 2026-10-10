// FR-13 since-last-visit: same doctor name + registration number sees only what is dated after their last view.
// Usage: node --env-file=.env.local scripts/e2e/phase-j.mjs
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

// A private copy of Ravi (inherits the seeded 20 Aug visit by Dr. A. Suresh) with a full-record link.
const { data: template } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", "Ravi Kumar").single();
const { data: created } = await admin.auth.admin.createUser({ email: `phasej-${Date.now()}@example.com`, password: randomBytes(18).toString("base64url"), email_confirm: true, user_metadata: { demo: true, name: "Ravi Kumar" } });
const userId = created.user.id;
await admin.rpc("clone_demo_patient", { p_template: template.id, p_owner: userId });
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
const token = randomBytes(32).toString("base64url");
await admin.from("share_links").insert({ patient_id: patient.id, token_hash: createHash("sha256").update(token).digest("hex"), label: "Phase j", scope_type: "all", expires_at: new Date(Date.now() + 3600000).toISOString() });

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function openAs(url, name, reg, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.getByLabel("Your name").waitFor();
  p.prefilled = [await p.getByLabel("Your name").inputValue(), await p.getByLabel(/Registration number/).inputValue()];
  if (name !== null) await p.getByLabel("Your name").fill(name);
  if (reg !== null) await p.getByLabel(/Registration number/).fill(reg);
  await p.getByRole("button", { name: "Open records" }).click();
  await p.getByText("Viewing as").waitFor({ timeout: 30000 });
  return p;
}

try {
  // 1. The landing page's sample doctor link: pre-filled as Dr. A. Suresh, last view 20 Aug 2026.
  const s = await openAs(`${BASE}/demo/doctor`, null, null);
  check("sample link pre-fills the returning doctor", s.prefilled.join("|") === "Dr. A. Suresh|TNMC 61234");
  check("opens on 'Since your last view, 20 Aug 2026'", await seen(s.getByRole("button", { name: /Since your last view, 20 Aug 2026/, pressed: true })));
  check("new prescription since then: Gluconorm (2 Sept)", await seen(s.getByText("Started Gluconorm")));
  check("new prescription since then: Mox (25 Sept)", await seen(s.getByText("Started Mox")));
  check("new allergy clash listed under new warnings", await seen(s.locator("section", { has: s.getByRole("heading", { name: /New warnings/ }) }).getByText(/Mox/)));
  check("new HbA1c compared with the value before the last view", await seen(s.getByText(/was 7\.1/)));
  check("nothing dated before 20 Aug is listed (Telma started 20 Aug)", (await s.getByText("Started Telma").count()) === 0);
  await s.screenshot({ path: `${shots}/since-last-visit-desktop.png`, fullPage: true, caret: "initial" });
  await s.getByRole("button", { name: "Full brief" }).click();
  check("Full brief one tap away", await seen(s.getByRole("heading", { name: /Key results/ })));
  await s.context().close();

  // 2. A second sample visitor still compares with the seeded visit, not with the first visitor.
  const s2 = await openAs(`${BASE}/demo/doctor`, null, null, 390);
  check("next sample visitor still sees the 20 Aug comparison", await seen(s2.getByRole("button", { name: /Since your last view, 20 Aug 2026/ })));
  await s2.screenshot({ path: `${shots}/since-last-visit-mobile.png`, fullPage: true, caret: "initial" });
  await s2.context().close();

  // 3. Private copy: name/number written differently still match; no number means no comparison.
  const p1 = await openAs(`${BASE}/s#${token}`, "dr a suresh", "tnmc-61234");
  check("same doctor matched despite different spelling of name and number", await seen(p1.getByRole("button", { name: /Since your last view, 20 Aug 2026/ })));
  await p1.context().close();
  const p2 = await openAs(`${BASE}/s#${token}`, "Dr. A. Suresh", "TNMC 61234");
  check("visit right after: nothing new since the last view", await seen(p2.getByText(/Nothing new is dated after your last view/)));
  check("and the full brief shows", await seen(p2.getByRole("heading", { name: /Key results/ })));
  await p2.context().close();
  const p3 = await openAs(`${BASE}/s#${token}`, "Dr. Meera Iyer", null);
  check("new doctor without a number gets the full brief only", (await p3.getByText(/Since your last view|Nothing new is dated/).count()) === 0 && (await seen(p3.getByRole("heading", { name: /Key results/ }))));
  await p3.context().close();
  const { data: logs } = await admin.from("access_logs").select("viewer_reg_no").eq("patient_id", patient.id).eq("action", "opened").not("share_link_id", "is", null);
  check("registration number recorded in the access log", logs?.filter((l) => l.viewer_reg_no).length === 2);
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
