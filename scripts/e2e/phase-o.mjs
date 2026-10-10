// Two prescriptions from two doctors with the same medicines under other brands (demo-docs/overlap-test):
// duplicate-therapy warnings and a major interaction. Usage: node --env-file=.env.local scripts/e2e/phase-o.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const email = `overlap-${Date.now()}@example.com`, password = "overlap-pass-123";
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Test Patient" } });
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", created.user.id).single();
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  for (const f of ["demo-docs/overlap-test/p1.pdf", "demo-docs/overlap-test/p2.jpg"]) {
    await page.goto(`${BASE}/upload`);
    await page.getByRole("radio", { name: "Prescription" }).click();
    await page.locator("input[type=file]:not([capture])").setInputFiles(f);
    await page.getByRole("button", { name: "Upload record" }).click();
    await page.waitForURL(/\/records\/[0-9a-f-]{36}$/, { timeout: 90000 });
    await page.getByRole("button", { name: "Save to my record" }).waitFor({ timeout: 90000 });
    await page.waitForTimeout(500);
    const meds = await page.locator("input[id^=med-]").evaluateAll((els) => els.map((e) => e.value));
    check(`${f.split("/").pop()} read 4 medicines (${meds.join(", ")})`, meds.length === 4);
    await page.getByRole("button", { name: "Save to my record" }).click();
    await page.getByRole("link", { name: "Add another" }).waitFor({ timeout: 30000 });
  }
  await page.goto(`${BASE}/medicines`);
  await page.getByText("Safety checks").waitFor();
  for (const w of ["Metformin prescribed twice", "Telmisartan prescribed twice", "Atorvastatin prescribed twice", "Major interaction: Clopilet and Omez"]) {
    check(w, await page.getByText(w).first().waitFor({ timeout: 10000 }).then(() => true, () => false));
  }
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(created.user.id);
  console.log(results.join("\n"));
}
