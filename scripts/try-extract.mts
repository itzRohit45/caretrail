// Runs the real extraction pipeline on local files and prints what the model returned.
// Usage: npx tsx --conditions=react-server --env-file=.env.local scripts/try-extract.mts <file>...
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extractDocument } from "@/lib/extraction/run";

const mime = (f: string) => (f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "image/jpeg");

for (const file of process.argv.slice(2)) {
  const data = await readFile(file);
  const hash = createHash("sha256").update(data).digest("hex");
  const t = Date.now();
  const r = await extractDocument({ hash, data, mimeType: mime(file) });
  console.log(`\n## ${file.split("/").pop()}  (${Date.now() - t} ms)`);
  if (!r.ok) {
    console.log("FAILED:", r.reason);
    continue;
  }
  const d = r.data;
  console.log(`model=${r.model} cached=${r.cached} type=${d.document_type} medical=${d.is_medical_document}`);
  console.log(`date=${d.document_date?.value} (${d.document_date?.confidence}) facility=${d.facility?.value} doctor=${d.doctor_name?.value}`);
  for (const m of d.medications) console.log(`  MED ${m.brand_name} | ${m.strength ?? "-"} | ${m.frequency ?? "-"} | ${m.duration_days ?? "-"}d | conf ${m.confidence} | src "${m.source_text}"`);
  for (const l of d.lab_results) console.log(`  LAB ${l.test_name} = ${l.value} ${l.unit ?? ""} [${l.ref_range ?? ""}] ${l.test_date ?? ""} | conf ${l.confidence}`);
  for (const c of d.conditions) console.log(`  DX  ${c.name} | conf ${c.confidence} | src "${c.source_text}"`);
}
