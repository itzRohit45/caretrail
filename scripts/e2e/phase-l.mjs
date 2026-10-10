// FR-15 FHIR export: the patient downloads their record as a FHIR R4 bundle from Profile.
// Usage: node --env-file=.env.local scripts/e2e/phase-l.mjs
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = `phasel-${Date.now()}@example.com`;
const password = "phase-l-pass-123";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) process.exitCode = 1;
};

const { data: template } = await admin.from("patients").select("id").eq("is_demo_template", true).eq("name", "Ravi Kumar").single();
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true, name: "Ravi Kumar" } });
const userId = created.user.id;
await admin.rpc("clone_demo_patient", { p_template: template.id, p_owner: userId });
const { data: patient } = await admin.from("patients").select("id").eq("owner_user_id", userId).single();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ acceptDownloads: true });
try {
  const anon = await page.request.get(`${BASE}/api/export/fhir`, { maxRedirects: 0 });
  check(`logged-out export refused (${anon.status()})`, anon.status() === 401);

  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/home");
  await page.goto(`${BASE}/profile`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my record (FHIR)" }).click()]);
  check(`file named by date (${download.suggestedFilename()})`, /^caretrail-record-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
  const bundle = JSON.parse(await readFile(await download.path(), "utf8"));
  const of = (t) => bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === t);
  check("FHIR R4 collection bundle", bundle.resourceType === "Bundle" && bundle.type === "collection");

  const { count: meds } = await admin.from("medications").select("id", { count: "exact", head: true }).eq("patient_id", patient.id);
  const { count: labs } = await admin.from("lab_results").select("id", { count: "exact", head: true }).eq("patient_id", patient.id);
  const { count: conds } = await admin.from("conditions").select("id", { count: "exact", head: true }).eq("patient_id", patient.id);
  check(`every medicine exported (${of("MedicationStatement").length}/${meds})`, of("MedicationStatement").length === meds);
  check(`every result exported (+ blood group) (${of("Observation").length}/${labs + 1})`, of("Observation").length === labs + 1);
  check(`every condition exported (${of("Condition").length}/${conds})`, of("Condition").length === conds);
  check("allergy with high criticality", of("AllergyIntolerance").some((a) => a.code.text === "Penicillin" && a.criticality === "high"));
  check("stopped medicine kept as stopped", of("MedicationStatement").some((m) => /Amlong/.test(m.medicationCodeableConcept.text) && m.status === "stopped"));
  check("HbA1c coded with LOINC 4548-4", of("Observation").some((o) => o.code.coding?.[0]?.code === "4548-4" && o.valueQuantity?.value === 7.4));
  check("every fact points at this patient only", bundle.entry.every((e) => e.resource.resourceType === "Patient" ? e.resource.id === patient.id : (e.resource.subject ?? e.resource.patient).reference === `urn:uuid:${patient.id}`));
  check("facts carry their source", of("MedicationStatement").every((m) => /^Source: /.test(m.note?.[0]?.text ?? "")));
} catch (err) {
  check(`unexpected error: ${err.message.split("\n")[0]}`, false);
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  console.log(results.join("\n"));
}
