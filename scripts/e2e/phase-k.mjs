// FR-14 doctor write-back: patient allows it per link; doctor adds a note and uploads a prescription that goes
// through the same extraction and waits for the patient, marked "Added by <doctor>".
// Usage: node --env-file=.env.local scripts/e2e/phase-k.mjs
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const shots = ".impeccable/review";
const email = `phasek-${Date.now()}@example.com`;
const password = "phase-k-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};
const seen = (loc, timeout = 30000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const { data: template } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", "Ravi Kumar").single();
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true, name: "Ravi Kumar" } });
const userId = created.user.id;
await admin.rpc("clone_demo_patient", { p_template: template.id, p_owner: userId });
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();
// A second link without write-back, to prove the server refuses it.
const plainToken = randomBytes(32).toString("base64url");
await admin.from("share_links").insert({ patient_id: patient.id, token_hash: createHash("sha256").update(plainToken).digest("hex"), label: "No write-back", scope_type: "all", expires_at: new Date(Date.now() + 3600000).toISOString() });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const doc = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");

  await page.goto(`${BASE}/sharing`);
  await page.getByLabel("Who is it for?").fill("Dr. Meera, today's visit");
  await page.locator("label", { hasText: "Everything" }).click();
  await page.locator("label", { hasText: "1 hour" }).click();
  check("write-back is off unless the patient turns it on", !(await page.getByRole("checkbox", { name: /Let the doctor add to my record/ }).isChecked()));
  await page.getByText("Let the doctor add to my record").click();
  const [resp] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/shares") && r.request().method() === "POST"), page.getByRole("button", { name: "Create link" }).click()]);
  const share = (await resp.json()).data;
  check("active link says the doctor can add", await seen(page.getByText("Can add notes and prescriptions")));

  // Without write-back: no panel, and the API refuses even a hand-made request.
  await doc.goto(`${BASE}/s#${plainToken}`);
  await doc.getByLabel("Your name").fill("Dr. Meera Iyer");
  const [opened] = await Promise.all([doc.waitForResponse((r) => r.url().endsWith("/api/s/open")), doc.getByRole("button", { name: "Open records" }).click()]);
  const plainSession = (await opened.json()).data.session_id;
  await doc.getByText("Viewing as").waitFor();
  check("no add panel on a link without write-back", (await doc.getByRole("heading", { name: /Add to Ravi's record/ }).count()) === 0);
  const refused = await doc.evaluate(async ([t, sid]) => (await fetch("/api/s/notes", { method: "POST", headers: { "content-type": "application/json", "x-share-token": t, "x-viewer-session": sid }, body: JSON.stringify({ note: "Should not save" }) })).status, [plainToken, plainSession]);
  check(`note API refused without write-back (${refused})`, refused === 403);

  // With write-back.
  await doc.goto("about:blank");
  await doc.goto(share.url);
  await doc.getByLabel("Your name").fill("Dr. Meera Iyer");
  await doc.getByRole("button", { name: "Open records" }).click();
  check("add panel shown on the write-back link", await seen(doc.getByRole("heading", { name: "Add to Ravi's record" })));
  await doc.getByRole("button", { name: "Save note" }).click();
  check("empty note refused", await seen(doc.getByText("Write the note first.")));
  await doc.getByLabel("Note for Ravi").fill("Stop Mox: penicillin allergy. Azithromycin 500 mg once daily for 3 days instead.");
  await doc.getByRole("button", { name: "Save note" }).click();
  check("note saved", await seen(doc.getByText("Note saved to Ravi's record.")));
  await doc.locator("#wb-file").setInputFiles("demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg");
  await doc.getByRole("button", { name: "Upload prescription" }).click();
  check("prescription read and sent to the patient to check", await seen(doc.getByText(/Sent to Ravi to check/), 90000));
  check("doctor sees what they added", await seen(doc.getByText("Waiting for the patient to check")));
  await doc.screenshot({ path: `${shots}/write-back-doctor-desktop.png`, fullPage: true, caret: "initial" });

  const { data: upload } = await admin.from("documents").select("id, uploaded_by, extraction_status, upload_status").eq("patient_id", patient.id).like("uploaded_by", "doctor:%").single();
  check("stored as the doctor's upload, waiting for review", upload?.uploaded_by === "doctor:Dr. Meera Iyer" && upload.extraction_status === "needs_review" && upload.upload_status === "uploaded");
  const { count: factCount } = await admin.from("medications").select("id", { count: "exact", head: true }).eq("source_document_id", upload.id);
  check("nothing joins the record before the patient checks", factCount === 0);

  // Patient side.
  await page.goto(`${BASE}/home`);
  check("Home shows the doctor's note", await seen(page.getByText(/Stop Mox: penicillin allergy/)));
  check("Home lists the upload as added by the doctor", await seen(page.getByText("Added by Dr. Meera Iyer")));
  await page.screenshot({ path: `${shots}/write-back-home-desktop.png`, fullPage: true, caret: "initial" });
  await page.goto(`${BASE}/records/${upload.id}`);
  check("review screen says who added it", await seen(page.getByText(/Dr\. Meera Iyer added this through your share link/)));
  await page.getByRole("button", { name: "Save to my record" }).click();
  check("after saving, the record is marked Added by the doctor", await seen(page.getByText("Added by Dr. Meera Iyer"), 30000));
  const { count: after } = await admin.from("medications").select("id", { count: "exact", head: true }).eq("source_document_id", upload.id);
  check(`facts saved once the patient confirmed (${after} medicines)`, after > 0);
  await page.goto(`${BASE}/sharing/history`);
  check("access history: note", await seen(page.getByText("Dr. Meera Iyer added a note")));
  check("access history: prescription", await seen(page.getByText("Dr. Meera Iyer added a prescription for you to check")));
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
  await doc.screenshot({ path: `${shots}/failure-k.png`, fullPage: true, caret: "initial" }).catch(() => {});
} finally {
  await browser.close();
  const { data: files } = await admin.storage.from("documents").list(patient.id);
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${patient.id}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
