// Seeds the three demo patients by running the REAL pipeline on the simulated documents in demo-docs/:
// upload to private storage -> Gemini extraction (cached by file hash) -> normalisation -> facts.
// Every extracted field is saved exactly as read (as if the patient pressed Save without edits).
// Usage: npx tsx --conditions=react-server --env-file=.env.local --tsconfig tsconfig.json scripts/seed-demo.mts
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/extraction/run";
import { loadReference, payloadFromExtraction, saveFacts } from "@/lib/records/save";
import { hashToken, newToken } from "@/lib/sharing/tokens";

const TEMPLATE_OWNER = "demo-templates@example.com";
const alertEmail = process.env.DEMO_ALERT_EMAIL || null;
const PATIENTS = {
  ravi: { name: "Ravi Kumar", dob: "1971-03-14", sex: "male", blood: "B+", contact: ["Priya Kumar", "+91 98450 31267"], allergies: [["Penicillin", "severe", "Rash and swelling"]] },
  lakshmi: { name: "Lakshmi Iyer", dob: "1984-07-22", sex: "female", blood: "A+", contact: ["Venkat Iyer", "+91 98840 55129"], allergies: [] },
  arun: { name: "Arun Prakash", dob: "1958-06-02", sex: "male", blood: "O+", contact: ["Karthik Prakash", "+91 98410 22764"], allergies: [["Sulfa drugs", "moderate", "Rash"]] },
} as const;

const db = adminClient();
const typeOf = (f: string) => (f.includes("-rx-") ? "prescription" : f.includes("-lab-") ? "lab_report" : f.includes("-discharge-") ? "discharge_summary" : f.includes("-echo-") ? "scan_report" : "other");
const mimeOf = (f: string) => (f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "image/jpeg");

async function owner() {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = data.users.find((u) => u.email === TEMPLATE_OWNER);
  if (found) return found.id;
  const { data: created, error } = await db.auth.admin.createUser({ email: TEMPLATE_OWNER, password: randomUUID() + randomUUID(), email_confirm: true, user_metadata: { demo: true, name: "Demo templates" } });
  if (error) throw error;
  return created.user.id;
}

async function extractWithRetry(file: { hash: string; data: Buffer; mimeType: string }) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await extractDocument(file);
    if (r.ok) return r;
    console.log(`   extraction ${r.reason}, retrying in ${attempt * 8}s`);
    await new Promise((res) => setTimeout(res, attempt * 8000));
  }
  throw new Error("extraction kept failing; seed aborted so no hand-typed data is ever used");
}

const ownerId = await owner();
const ref = await loadReference(db);
const { data: old } = await db.from("patients").select("id").eq("owner_user_id", ownerId).eq("is_demo_template", true);
if (old?.length) await db.from("patients").delete().in("id", old.map((p) => p.id));

const ids: Record<string, string> = {};
for (const [key, p] of Object.entries(PATIENTS)) {
  const { data: patient, error } = await db
    .from("patients")
    .insert({ owner_user_id: ownerId, name: p.name, dob: p.dob, sex: p.sex, blood_group: p.blood, emergency_contact_name: p.contact[0], emergency_contact_phone: p.contact[1], emergency_contact_email: alertEmail, is_demo_template: true })
    .select("*")
    .single();
  if (error) throw error;
  ids[key] = patient.id;
  for (const [substance, severity, reaction] of p.allergies) await db.from("allergies").insert({ patient_id: patient.id, substance, severity, reaction });

  const dir = `demo-docs/${key}`;
  for (const file of (await readdir(dir)).filter((f) => /\.(pdf|jpg|png)$/.test(f)).sort()) {
    const data = await readFile(`${dir}/${file}`);
    const hash = createHash("sha256").update(data).digest("hex");
    const id = randomUUID();
    const ext = file.split(".").pop()!;
    const path = `${patient.id}/${id}.${ext}`;
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
    const { data: saved } = await db.from("documents").select("doc_date").eq("id", id).single();
    if (saved?.doc_date) await db.from("documents").update({ created_at: `${saved.doc_date}T18:00:00+05:30` }).eq("id", id);
    console.log(` ${key} ${file}: ${r.cached ? "cached" : r.model} -> ${counts.medications} meds, ${counts.lab_results} labs, ${counts.conditions} dx (date ${saved?.doc_date})`);
  }
}

// History the patient would have recorded: Amlong was switched to Telma in hospital; Pantocid was a 14-day course.
await db.from("medications").update({ active: false, stopped_on: "2026-03-12" }).eq("patient_id", ids.ravi).ilike("brand_name", "%amlong%");
await db.from("medications").update({ active: false, stopped_on: "2026-03-26" }).eq("patient_id", ids.ravi).ilike("brand_name", "%pantocid%");

// Arun's emergency QR for the public demo link (the raw token lives only in .env.local / Vercel env).
const token = newToken();
await db.from("patients").update({ emergency_token_hash: hashToken(token), emergency_token_created_at: new Date().toISOString() }).eq("id", ids.arun);
const env = await readFile(".env.local", "utf8");
await writeFile(".env.local", env.replace(/^DEMO_EMERGENCY_TOKEN=.*$/m, `DEMO_EMERGENCY_TOKEN=${token}`));
console.log("\ntemplates:", JSON.stringify(ids), "\nDEMO_EMERGENCY_TOKEN written to .env.local");
