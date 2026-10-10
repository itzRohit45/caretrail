// Mobile captures of every patient screen (390 and 360 px) using Try demo.
// Usage: E2E_BASE_URL=... node --env-file=.env.local scripts/e2e/mobile-shots.mjs [label]
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "m";
const out = `.impeccable/review/${label}`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const started = new Date().toISOString();
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
    await p.getByRole("button", { name: /Try as Ravi/ }).click();
    await p.waitForURL("**/home", { timeout: 60000 });
    await p.getByText("Latest results").waitFor();
    for (const [path, name, wait] of [
      ["/home", "home", "Latest results"],
      ["/records", "records", "September 2026"],
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
    await p.goto(`${BASE}/demo/doctor`);
    await p.getByRole("button", { name: /Open records/ }).waitFor({ timeout: 30000 }).catch(() => {});
    if (await p.getByRole("button", { name: /Open records/ }).count()) {
      await p.getByLabel("Your name").fill("Dr Meera Iyer");
      await shot(p, `${w}-doctor-gate`);
      await p.getByRole("button", { name: /Open records/ }).click();
    }
    await p.getByText(/Allerg/).first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(800);
    await shot(p, `${w}-doctor`);
    await p.goto(`${BASE}/demo/emergency`);
    await p.getByText(/Blood group/i).first().waitFor({ timeout: 30000 });
    await shot(p, `${w}-emergency`);
    await p.goto(`${BASE}/upload`);
    await p.getByText("What is it?").waitFor();
    if (w === 390) {
      await p.getByRole("radio", { name: "Prescription" }).click();
      await p.locator("input[type=file]:not([capture])").setInputFiles("demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg");
      await p.getByRole("button", { name: "Upload record" }).click();
      await p.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 60000 });
      await p.getByRole("button", { name: "Save to my record" }).waitFor({ timeout: 60000 });
      await shot(p, `${w}-review`);
      await p.getByRole("button", { name: "Save to my record" }).click();
      await p.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });
      await shot(p, `${w}-record`);
      await p.goto(`${BASE}/medicines`);
      await p.getByText("Safety checks").waitFor();
      await shot(p, `${w}-medicines-after-upload`);
    }
    await ctx.close();
  }
  console.log("captured to", out);
  console.log(overflow.length ? `HORIZONTAL OVERFLOW:\n${overflow.join("\n")}` : "no horizontal overflow on any screen");
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.user_metadata?.demo && u.email?.startsWith("demo-") && u.created_at >= started)) await admin.auth.admin.deleteUser(u.id);
}
