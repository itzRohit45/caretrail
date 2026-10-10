// Accessibility audit (axe-core, WCAG 2.1 AA) across every screen with real demo data, plus dark-mode captures.
// Usage: node --env-file=.env.local scripts/e2e/audit.mjs
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const started = new Date().toISOString();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];

async function audit(page, name) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  for (const v of r.violations) report.push(`${name}: [${v.impact}] ${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(" ")} :: ${v.nodes[0].failureSummary?.split("\n")[1]?.trim() ?? ""}`);
  if (!r.violations.length) report.push(`${name}: clean`);
}

try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    if (scheme === "light") await audit(p, "landing");
    await p.goto(`${BASE}/login`);
    if (scheme === "light") await audit(p, "login");
    await p.getByRole("button", { name: /Try as Ravi/ }).click();
    await p.waitForURL("**/home", { timeout: 60000 });
    await p.getByText("Latest results").waitFor();
    for (const [path, name, wait] of [
      ["/home", "home", "Latest results"],
      ["/records", "records", "September 2026"],
      ["/records/trends", "trends", "HbA1c"],
      ["/medicines", "medicines", "Safety checks"],
      ["/sharing", "sharing", "Active links"],
      ["/sharing/history", "history", "Who saw your records"],
      ["/emergency-card", "emergency-card", "Emergency QR"],
      ["/upload", "upload", "What is it?"],
      ["/profile", "profile", "Allergies"],
    ]) {
      await p.goto(`${BASE}${path}`);
      await p.getByText(wait).first().waitFor({ timeout: 30000 });
      await p.waitForTimeout(400);
      if (scheme === "light") await audit(p, name);
      if (scheme === "dark" && ["home", "medicines", "trends"].includes(name)) await p.screenshot({ path: `${shots}/dark-${name}.png`, fullPage: true, caret: "initial" });
    }
    const first = await p.getByRole("link", { name: /Lakshmanan ENT Centre/ }).first();
    if (scheme === "light") {
      await p.goto(`${BASE}/home`);
      await p.getByRole("link", { name: /Lakshmanan ENT Centre/ }).first().click();
      await p.getByRole("heading", { name: "Lakshmanan ENT Centre" }).waitFor();
      await audit(p, "record-saved");
    }
    void first;
    const d = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: scheme })).newPage();
    await d.goto(`${BASE}/demo/doctor`);
    if (scheme === "light") await audit(d, "doctor-gate");
    await d.getByLabel("Your name").fill("Dr. Audit");
    await d.getByRole("button", { name: "Open records" }).click();
    await d.getByRole("heading", { name: "Ravi Kumar" }).waitFor();
    if (scheme === "light") await audit(d, "doctor-brief");
    else await d.screenshot({ path: `${shots}/dark-doctor.png`, fullPage: true, caret: "initial" });
    const e = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage();
    await e.goto(`${BASE}/demo/emergency`);
    await e.getByRole("heading", { name: "Arun Prakash" }).waitFor();
    if (scheme === "light") await audit(e, "emergency");
    else await e.screenshot({ path: `${shots}/dark-emergency.png`, caret: "initial" });
    await ctx.close();
  }
} finally {
  await browser.close();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.user_metadata?.demo && u.email?.startsWith("demo-") && u.created_at >= started)) await admin.auth.admin.deleteUser(u.id);
  console.log(report.join("\n"));
}
