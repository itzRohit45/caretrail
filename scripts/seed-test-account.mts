// Creates (or rebuilds) the dedicated test account and uploads every sample document of one simulated
// patient through the REAL pipeline: private storage -> Gemini extraction (cached by file hash) ->
// normalisation -> facts. Every field is saved exactly as read (as if the patient pressed Save).
// Usage: npm run seed:test-account
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/extraction/run";
import { loadReference, payloadFromExtraction, saveFacts } from "@/lib/records/save";

export const TEST_ACCOUNT = { email: "caretrail.test@example.com", password: "CareTrail@2026" };
const PROFILE = { name: "Ravi Kumar", dob: "1971-03-14", sex: "male", blood_group: "B+", emergency_contact_name: "Priya Kumar", emergency_contact_phone: "+91 98450 31267" };
const DOCS = "demo-docs/ravi";

const db = adminClient();
const typeOf = (f: string) => (f.includes("-rx-") ? "prescription" : f.includes("-lab-") ? "lab_report" : f.includes("-discharge-") ? "discharge_summary" : f.includes("-echo-") ? "scan_report" : "other");
const mimeOf = (f: string) => (f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "image/jpeg");

async function extractWithRetry(file: { hash: string; data: Buffer; mimeType: string }) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await extractDocument(file);
    if (r.ok) return r;
    console.log(`   extraction ${r.reason}, retrying in ${attempt * 8}s`);
    await new Promise((res) => setTimeout(res, attempt * 8000));
  }
  throw new Error("extraction kept failing; stopped so no hand-typed data is ever used");
}

// Start clean: the old account (and its files) is removed first.
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const old = list.users.find((u) => u.email === TEST_ACCOUNT.email);
if (old) {
  const { data: pats } = await db.from("patients").select("id").eq("owner_user_id", old.id);
  for (const p of pats ?? []) {
    const { data: objs } = await db.storage.from("documents").list(p.id, { limit: 1000 });
    if (objs?.length) await db.storage.from("documents").remove(objs.map((o) => `${p.id}/${o.name}`));
  }
  await db.auth.admin.deleteUser(old.id);
}
const { data: created, error } = await db.auth.admin.createUser({ email: TEST_ACCOUNT.email, password: TEST_ACCOUNT.password, email_confirm: true, user_metadata: { name: PROFILE.name } });
if (error) throw error;
const { data: patient } = await db.from("patients").update(PROFILE).eq("owner_user_id", created.user.id).select("*").single();
if (!patient) throw new Error("profile was not created");
await db.from("allergies").insert({ patient_id: patient.id, substance: "Penicillin", severity: "severe", reaction: "Rash and swelling" });

const ref = await loadReference(db);
for (const file of (await readdir(DOCS)).filter((f) => /\.(pdf|jpg|png)$/.test(f)).sort()) {
  const data = await readFile(`${DOCS}/${file}`);
  const hash = createHash("sha256").update(data).digest("hex");
  const id = randomUUID();
  const path = `${patient.id}/${id}.${file.split(".").pop()}`;
  const up = await db.storage.from("documents").upload(path, data, { contentType: mimeOf(file), upsert: true });
  if (up.error) throw up.error;
  const r = await extractWithRetry({ hash, data, mimeType: mimeOf(file) });
  const { data: doc, error: docError } = await db
    .from("documents")
    .insert({ id, patient_id: patient.id, type: typeOf(file), file_hash: hash, storage_path: path, mime_type: mimeOf(file), size_bytes: data.length, original_filename: file, upload_status: "uploaded", extraction_status: "needs_review", extraction: r.data, verified_at: new Date().toISOString() })
    .select("*")
    .single();
  if (docError) throw docError;
  const counts = await saveFacts(db, doc, payloadFromExtraction(r.data), ref);
  // Each paper was added around the day it is dated, as a patient keeping up their record would.
  const { data: saved } = await db.from("documents").select("doc_date").eq("id", id).single();
  if (saved?.doc_date) await db.from("documents").update({ created_at: `${saved.doc_date}T18:00:00+05:30` }).eq("id", id);
  console.log(` ${file}: ${r.cached ? "cached" : r.model} -> ${counts.medications} meds, ${counts.lab_results} labs, ${counts.conditions} dx (date ${saved?.doc_date})`);
}

// What the patient would have recorded: Amlong was switched to Telma in hospital (March 2026).
await db.from("medications").update({ active: false, stopped_on: "2026-03-12" }).eq("patient_id", patient.id).ilike("brand_name", "%amlong%");
console.log(`\nTest account ready: ${TEST_ACCOUNT.email} / ${TEST_ACCOUNT.password}`);
