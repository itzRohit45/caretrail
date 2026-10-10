// Mobile captures of every screen (390 and 360 px): the test account for viewing, a temporary account for
// uploads and the emergency page. Share links it creates are ended afterwards.
// Usage: E2E_BASE_URL=... node --env-file=.env.local scripts/e2e/mobile-shots.mjs [label]
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "m";
const out = `.impeccable/review/${label}`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const links = [];
const { createHash, randomBytes } = await import("node:crypto");
const { data: tmp } = await admin.auth.admin.createUser({ email: `mobile-${Date.now()}@example.com`, password: "mobile-shots-123", email_confirm: true, user_metadata: { name: "Arun Prakash" } });
const { data: tmpPatient } = await admin.from("patients").select("id").eq("owner_user_id", tmp.user.id).single();
const eToken = randomBytes(32).toString("base64url");
await admin.from("patients").update({ blood_group: "O+", emergency_contact_name: "Karthik Prakash", emergency_contact_phone: "+91 98410 22764", emergency_token_hash: createHash("sha256").update(eToken).digest("hex"), emergency_token_created_at: new Date().toISOString() }).eq("id", tmpPatient.id);
await admin.from("allergies").insert({ patient_id: tmpPatient.id, substance: "Sulfa drugs", severity: "moderate", reaction: "Rash" });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const overflow = [];
// Anything wider than the viewport makes the whole page pan sideways on a phone.
async function checkOverflow(p, name) {
  const wide = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= vw) return [];
    return [...document.querySelectorAll("body *")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed"; })
      .filter((el) => !el.closest("[class*='overflow-x-auto']"))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(el.getBoundingClientRect().right)}`);
  });
  if (wide.length) overflow.push(`${name}: ${wide.join(" | ")}`);
}
async function shot(p, name) {
  await checkOverflow(p, name);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true, caret: "initial" });
}
try {
  for (const [w, h] of [[390, 844], [360, 780]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    await shot(p, `${w}-landing`);
    await p.goto(`${BASE}/login`);
    await shot(p, `${w}-login`);
    await p.getByLabel("Email").fill("caretrail.test@example.com");
    await p.getByLabel("Password").fill("CareTrail@2026");
    await p.getByRole("button", { name: "Log in" }).click();
    await p.waitForURL("**/home", { timeout: 60000 });
    await p.getByText("Latest results").waitFor();
    for (const [path, name, wait] of [
      ["/home", "home", "Latest results"],
      ["/records", "records", "October 2026"],
      ["/records/trends", "trends", "HbA1c"],
      ["/medicines", "medicines", "Safety checks"],
      ["/sharing", "sharing", "Active links"],
      ["/sharing/history", "history", "This history cannot be edited"],
      ["/emergency-card", "emergency-card", "Emergency QR"],
      ["/profile", "profile", "Allergies"],
      ["/upload", "upload", "What is it?"],
    ]) {
      await p.goto(`${BASE}${path}`);
      await p.getByText(wait).first().waitFor({ timeout: 30000 });
      await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(500);
      await shot(p, `${w}-${name}`);
      if (name === "home") await p.screenshot({ path: `${out}/${w}-home-fold.png`, caret: "initial" });
    }
    await p.goto(`${BASE}/records`);
    await p.locator("main ol > li a").first().click();
    await p.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 30000 });
    await p.getByRole("heading", { level: 1 }).waitFor();
    await p.waitForTimeout(800);
    await shot(p, `${w}-record-detail`);
    const link = await p.evaluate(() => fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Mobile check", scope_type: "all", expires_in: "1h", allow_write_back: true }) }).then((r) => r.json()));
    links.push(link.data.id);
    const dctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const dp = await dctx.newPage();
    await dp.goto(link.data.url);
    await dp.getByLabel("Your name").fill("Dr Meera Iyer");
    await shot(dp, `${w}-doctor-gate`);
    await dp.getByRole("button", { name: /Open records/ }).click();
    await dp.getByText(/Allerg/).first().waitFor({ timeout: 30000 });
    await dp.waitForTimeout(800);
    await shot(dp, `${w}-doctor`);
    await dp.goto(`${BASE}/e#${eToken}`);
    await dp.getByText(/Blood group/i).first().waitFor({ timeout: 30000 });
    await shot(dp, `${w}-emergency`);
    await dctx.close();
    await p.goto(`${BASE}/upload`);
    await p.getByText("What is it?").waitFor();
    await p.getByRole("radio", { name: "Consultation notes" }).click();
    await shot(p, `${w}-upload-notes`);
    await ctx.close();
    if (w !== 390) continue;
    // Uploads go into the temporary account, never the test account.
    const uctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const u = await uctx.newPage();
    await u.goto(`${BASE}/login`);
    await u.getByLabel("Email").fill(tmp.user.email);
    await u.getByLabel("Password").fill("mobile-shots-123");
    await u.getByRole("button", { name: "Log in" }).click();
    await u.waitForURL("**/home", { timeout: 60000 });
    await u.goto(`${BASE}/upload`);
    await u.getByRole("radio", { name: "Prescription" }).click();
    await u.locator("input[type=file]:not([capture])").setInputFiles("demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg");
    await u.getByRole("button", { name: "Upload record" }).click();
    await u.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 60000 });
    await u.getByRole("button", { name: "Save to my record" }).waitFor({ timeout: 60000 });
    await shot(u, `${w}-review`);
    await u.getByRole("button", { name: "Save to my record" }).click();
    await u.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });
    await shot(u, `${w}-record`);
    await u.goto(`${BASE}/medicines`);
    await u.getByText("Safety checks").waitFor();
    await shot(u, `${w}-medicines-after-upload`);
    await uctx.close();
  }
  console.log("captured to", out);
  console.log(overflow.length ? `HORIZONTAL OVERFLOW:\n${overflow.join("\n")}` : "no horizontal overflow on any screen");
} finally {
  await browser.close();
  if (links.length) await admin.from("share_links").update({ revoked_at: new Date().toISOString() }).in("id", links);
  const { data: files } = await admin.storage.from("documents").list(tmpPatient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${tmpPatient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(tmp.user.id);
}
