// Browser smoke test for auth + profile. Usage: node --env-file=.env.local scripts/e2e/phase-a.mjs
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `smoke-${Date.now()}@example.com`;
const password = "smoke-test-pass-123";
const results = [];
const seen = (locator, timeout = 30000) => locator.first().waitFor({ timeout }).then(() => true, () => false);
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  await page.goto(`${BASE}/`);
  await page.screenshot({ path: `${shots}/landing-desktop.png` });

  await page.goto(`${BASE}/home`);
  check("logged-out /home redirects to login with next", page.url().includes("/login?next=%2Fhome"));

  await page.goto(`${BASE}/signup`);
  await page.getByRole("button", { name: "Create account" }).click();
  check("empty signup shows field errors", await seen(page.getByText("Enter your name.")));
  await page.getByLabel("Your name").fill("Smoke Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/home");
  check("signup lands on home with greeting", await seen(page.getByRole("heading", { name: /Smoke$/ })));
  await page.screenshot({ path: `${shots}/home-desktop.png`, fullPage: true });

  await page.goto(`${BASE}/profile`);
  await page.getByLabel("Blood group").selectOption("O+");
  await page.getByLabel("Phone").fill("call me");
  await page.getByRole("button", { name: "Save details" }).click();
  check("invalid phone shows inline error", await seen(page.getByText(/Enter a phone number/)));
  check("typed values survive a failed save", (await page.getByLabel("Phone").inputValue()) === "call me");
  await page.getByLabel("Phone").fill("+91 98400 12345");
  await page.locator("#emergency_contact_name").fill("Priya Kumar");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText("Saved.").waitFor();
  check("profile saves", true);

  await page.getByLabel("Allergic to").fill("Penicillin");
  await page.getByRole("radio", { name: "severe" }).check();
  await page.getByLabel("What happens").fill("Rash");
  await page.getByRole("button", { name: "Add allergy" }).click();
  await page.getByText("Added Penicillin.").waitFor();
  check("allergy added and listed", await seen(page.locator("li", { hasText: "Penicillin" }).first()));

  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator("li").getByLabel("What happens").fill("Rash and swelling");
  await page.locator("li").getByRole("button", { name: "Save" }).click();
  await page.getByText("Rash and swelling").waitFor();
  check("allergy edited", true);
  await page.screenshot({ path: `${shots}/profile-desktop.png`, fullPage: true });

  for (const [path, name] of [["/home", "home"], ["/profile", "profile"]]) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.addCookies(await page.context().cookies());
    const p = await m.newPage();
    await p.goto(`${BASE}${path}`);
    await p.screenshot({ path: `${shots}/${name}-mobile.png`, fullPage: true });
    await m.close();
  }

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove Penicillin" }).click();
  await page.getByText("No allergies recorded.").waitFor();
  check("allergy removed after confirm", true);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/profile`);
  check("after logout, /profile needs login", page.url().includes("/login?next=%2Fprofile"));
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/profile");
  check("login returns to the page you were on", page.url().endsWith("/profile"));
  check("saved blood group persisted", (await page.getByLabel("Blood group").inputValue()) === "O+");
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = data?.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  console.log(results.join("\n"));
}
