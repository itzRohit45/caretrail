// Accessibility audit (axe-core, WCAG 2.1 AA) across every screen of the test account, plus dark-mode captures.
// Share links it creates are ended afterwards; the emergency page uses a temporary account.
// Usage: node --env-file=.env.local scripts/e2e/audit.mjs
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const links = [];
// Temporary patient with an emergency QR for the public emergency page.
const { data: tmp } = await admin.auth.admin.createUser({ email: `audit-${Date.now()}@example.com`, password: randomBytes(18).toString("base64url"), email_confirm: true, user_metadata: { name: "Arun Prakash" } });
const { data: tmpPatient } = await admin.from("patients").select("id").eq("owner_user_id", tmp.user.id).single();
const eToken = randomBytes(32).toString("base64url");
await admin.from("patients").update({ blood_group: "O+", emergency_contact_name: "Karthik Prakash", emergency_contact_phone: "+91 98410 22764", emergency_token_hash: createHash("sha256").update(eToken).digest("hex"), emergency_token_created_at: new Date().toISOString() }).eq("id", tmpPatient.id);
await admin.from("allergies").insert({ patient_id: tmpPatient.id, substance: "Sulfa drugs", severity: "moderate", reaction: "Rash" });
const share = (p, body) => p.evaluate((b) => fetch("/api/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()), body).then((r) => (links.push(r.data.id), r));
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
    if (scheme === "light") {
      await p.goto(`${BASE}/home`);
      await p.getByRole("button", { name: /^Alerts/ }).click();
      await p.getByRole("dialog", { name: "Alerts" }).waitFor();
      await p.waitForTimeout(800);
      await audit(p, "alerts-panel");
      await p.keyboard.press("Escape");
    }
    if (scheme === "light") {
      await p.goto(`${BASE}/upload`);
      await p.getByRole("radio", { name: "Consultation notes" }).click();
      await p.getByRole("heading", { name: "Write the notes" }).waitFor();
      await audit(p, "upload-consultation-notes");
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
    const doctorLink = await share(p, { label: "Audit", scope_type: "all", expires_in: "1h", allow_write_back: false });
    await d.goto(doctorLink.data.url);
    if (scheme === "light") await audit(d, "doctor-gate");
    await d.getByLabel("Your name").fill("Dr. Audit");
    await d.getByRole("button", { name: "Open records" }).click();
    await d.getByRole("heading", { name: /Key results/ }).waitFor();
    if (scheme === "light") await audit(d, "doctor-brief");
    else await d.screenshot({ path: `${shots}/dark-doctor.png`, fullPage: true, caret: "initial" });
    // Write-back panel: a link with "Let the doctor add notes and prescriptions" on.
    const wb = await share(p, { label: "Audit write-back", scope_type: "all", expires_in: "1h", allow_write_back: true });
    const w = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage();
    await w.goto(wb.data.url);
    await w.getByLabel("Your name").fill("Dr. Audit");
    await w.getByRole("button", { name: "Open records" }).click();
    await w.getByRole("heading", { name: /Add to Ravi's record/ }).waitFor();
    if (scheme === "light") await audit(w, "doctor-write-back");
    else await w.screenshot({ path: `${shots}/dark-write-back.png`, fullPage: true, caret: "initial" });
    const e = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage();
    await e.goto(`${BASE}/e#${eToken}`);
    await e.getByRole("heading", { name: "Arun Prakash" }).waitFor();
    if (scheme === "light") await audit(e, "emergency");
    else await e.screenshot({ path: `${shots}/dark-emergency.png`, caret: "initial" });
    await e.getByRole("button", { name: "Request full record" }).click();
    await e.getByLabel("Medical registration number").waitFor();
    if (scheme === "light") await audit(e, "emergency-break-glass");
    if (scheme === "light") {
      // Links created for the audit are ended so the test account stays tidy.
      for (const id of links.splice(0)) await p.evaluate((x) => fetch(`/api/shares/${x}/revoke`, { method: "POST" }), id);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  if (links.length) await admin.from("share_links").update({ revoked_at: new Date().toISOString() }).in("id", links);
  await admin.auth.admin.deleteUser(tmp.user.id);
  console.log(report.join("\n"));
}
