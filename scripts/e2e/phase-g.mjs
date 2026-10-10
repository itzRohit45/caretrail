// Emergency card: create QR, lock-screen image, public tier 1 page, scan logging, regenerate.
// Usage: node --env-file=.env.local scripts/e2e/phase-g.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phaseg-${Date.now()}@example.com`;
const password = "phase-g-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Arun Prakash" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
await admin.from("patients").update({ dob: "1958-06-02", sex: "male", blood_group: "O+", emergency_contact_name: "Karthik Prakash", emergency_contact_phone: "+91 98410 22764" }).eq("id", patient.id);
const { data: allergy } = await admin.from("allergies").insert({ patient_id: patient.id, substance: "Sulfa drugs", severity: "moderate", reaction: "Rash" }).select("id").single();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const er = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Prescription" }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles("demo-docs/arun/07-rx-farook-aug-2026-photo.jpg");
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.getByRole("button", { name: "Save to my record" }).click({ timeout: 60000 });
  await page.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });

  await page.goto(`${BASE}/home`);
  await page.getByRole("link", { name: "Set up emergency QR" }).click();
  const [resp] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/emergency/token") && r.request().method() === "POST"), page.getByRole("button", { name: "Create my emergency QR" }).click()]);
  const first = (await resp.json()).data.url;
  check("emergency QR created with token in fragment", /\/e#[A-Za-z0-9_-]{43}$/.test(first) && (await seen(page.getByRole("img", { name: "Your emergency QR code" }))));
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save lock-screen image" }).click()]);
  check("lock-screen image downloads as PNG", download.suggestedFilename() === "caretrail-emergency-lockscreen.png");
  check("wallet card print option present", await seen(page.getByRole("button", { name: "Print wallet card" })));
  await page.screenshot({ path: `${shots}/emergency-card-desktop.png`, fullPage: true, caret: "initial" });

  const token = first.split("#")[1];
  await er.goto(`${BASE}/e#${token}`);
  check("tier 1 card opens without login", await seen(er.getByRole("heading", { name: "Arun Prakash" })));
  check("blood group shown large", await seen(er.getByText("O+", { exact: true })));
  check("allergy shown in the severe band", await seen(er.getByText("Sulfa drugs")));
  check("current medicines listed (Dolo, as needed)", await seen(er.getByText("Dolo", { exact: false })));
  check("finished 14-day course left off the card (Omez)", (await er.getByText("Omez", { exact: false }).count()) === 0);
  const call = er.getByRole("link", { name: /Call Karthik Prakash/ });
  check("tap-to-call uses a tel: link", (await call.getAttribute("href")) === "tel:+919841022764");
  const box = await call.boundingBox();
  check(`call button above the fold on a 390x844 phone (bottom ${Math.round(box?.y + box?.height)} px)`, box && box.y + box.height <= 844);
  await er.screenshot({ path: `${shots}/emergency-mobile.png`, fullPage: true, caret: "initial" });
  await er.screenshot({ path: `${shots}/emergency-mobile-fold.png`, caret: "initial" });

  const { data: logs } = await admin.from("access_logs").select("action").eq("patient_id", patient.id).eq("action", "emergency_scan");
  check("scan written to the access log", (logs?.length ?? 0) >= 1);
  await page.goto(`${BASE}/home`);
  check("patient is told about the scan on Home", await seen(page.getByText(/Your emergency card was scanned/)));

  await admin.from("allergies").delete().eq("id", allergy.id);
  await er.reload();
  check("no allergies shows 'No known allergies recorded'", await seen(er.getByText("No known allergies recorded")));

  await page.goto(`${BASE}/emergency-card`);
  await page.getByRole("button", { name: "Make a new QR" }).click();
  await page.getByRole("button", { name: "Yes, make a new QR" }).click();
  await page.getByRole("img", { name: "Your emergency QR code" }).waitFor();
  await er.goto("about:blank");
  await er.goto(`${BASE}/e#${token}`);
  check("old QR stops working after regenerating", await seen(er.getByText("This emergency card is not valid")));
  const status = await er.evaluate(async (t) => (await fetch("/api/e", { headers: { "x-emergency-token": t } })).status, token);
  check(`old token refused by the API (${status})`, status === 410);
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure.png`, fullPage: true, caret: "initial" }).catch(() => {});
  await er.screenshot({ path: `${shots}/failure-er.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
