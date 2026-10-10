// Multi-page upload: several photos of one report become one PDF record; big phone photos are shrunk on
// the device before upload. Usage: node --env-file=.env.local scripts/e2e/phase-m.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasem-${Date.now()}@example.com`;
const password = "phase-m-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Page Tester" } });
const userId = created.user.id;
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");

  // 1. Two photos of one prescription, plus a third page from the camera button, then one removed.
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Prescription" }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles(["demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg", "demo-docs/ravi/07-rx-ramesh-sep-2026-photo.jpg"]);
  check("two photos listed as one record", await seen(page.getByText("2 pages, uploaded as one record in this order")));
  await page.locator("input[type=file][capture]").setInputFiles("demo-docs/lakshmi/04-rx-karthik-apr-2026-photo.jpg");
  check("camera adds a third page", await seen(page.getByText("3 pages, uploaded as one record in this order")));
  await page.getByRole("button", { name: "Remove 04-rx-karthik-apr-2026-photo.jpg" }).click();
  check("a page can be removed", await seen(page.getByText("2 pages, uploaded as one record in this order")));
  await page.screenshot({ path: `${shots}/upload-pages-mobile.png`, fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  check("both pages read: goes to the check screen", await seen(page.getByRole("heading", { name: "Check what we read" }), 90000));
  const { data: doc } = await admin.from("documents").select("id, mime_type, original_filename, size_bytes, extraction").eq("patient_id", patient.id).single();
  check(`stored as one PDF (${doc?.original_filename}, ${Math.round((doc?.size_bytes ?? 0) / 1024)} KB)`, doc?.mime_type === "application/pdf" && doc.original_filename === "Prescription (2 pages).pdf");
  const brands = (doc?.extraction?.medications ?? []).map((m) => m.brand_name.toLowerCase()).join(" ");
  check(`medicines read from both pages (${(doc?.extraction?.medications ?? []).length})`, /gluconorm/.test(brands) && (doc?.extraction?.medications ?? []).length >= 3);
  await page.getByRole("button", { name: /Show the document/ }).click();
  check("preview shows both pages", await seen(page.locator("canvas").nth(1), 20000));

  // 2. A large phone photo is shrunk on the device before upload.
  const big = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4000;
    c.height = 5000;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(4000, 5000);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 200 + Math.floor(Math.random() * 55);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const bigBuffer = Buffer.from(big, "base64");
  await page.goto(`${BASE}/upload`);
  await page.getByRole("radio", { name: "Other" }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "big-photo.jpg", mimeType: "image/jpeg", buffer: bigBuffer });
  await page.getByRole("button", { name: "Upload record" }).click();
  await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
  const { data: shrunk } = await admin.from("documents").select("size_bytes, mime_type").eq("patient_id", patient.id).eq("original_filename", "big-photo.jpg").single();
  check(`big photo shrunk before upload (${(bigBuffer.length / 1048576).toFixed(1)} MB -> ${(shrunk.size_bytes / 1048576).toFixed(1)} MB)`, shrunk.size_bytes < bigBuffer.length / 2 && shrunk.mime_type === "image/jpeg");
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await page.screenshot({ path: `${shots}/failure-m.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
