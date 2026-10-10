// Renders simulated demo documents to PDF and phone-photo JPEGs.
// Usage: node scripts/demo-docs/build.mjs   (needs Google Chrome and ImageMagick)
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { documents } from "./data.mjs";

const OUT = new URL("../../demo-docs/", import.meta.url).pathname;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FOOT = `<div class="sim">Simulated record created for the CareTrail demo. Not a real patient, clinic or doctor.</div>`;

const base = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; font-size: 12.5px; line-height: 1.45; background: #fff; }
  .page { padding: 28px 34px; position: relative; }
  .sim { margin-top: 26px; padding-top: 8px; border-top: 1px dashed #b9b9b9; font-size: 9.5px; color: #777; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  .sig { font-family: "Snell Roundhand", "Apple Chancery", cursive; font-size: 24px; color: #1f2a6b; }
`;

function letterhead(d, accent) {
  return `<header style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:12px">
    <div><div style="font-size:21px;font-weight:700;color:${accent}">${esc(d.clinic ?? d.hospital ?? d.lab)}</div>
      <div style="color:#555;max-width:330px">${esc(d.address)}</div><div style="color:#555">Ph: ${esc(d.phone)}</div></div>
    ${d.quals ? `<div style="text-align:right"><div style="font-size:16px;font-weight:700">${esc(d.doctor)}</div><div>${esc(d.quals)}</div><div style="color:#555">Reg. No: ${esc(d.reg)}</div></div>` : ""}
  </header>`;
}

function rx(d) {
  const hand = d.hand ? `font-family: 'Kalam', cursive; font-size: 18px; color: #1b2f80;` : "";
  return `<div class="page">${letterhead(d, "#0f6e6e")}
    <div style="display:flex;justify-content:space-between;margin:14px 0 6px;font-size:13px">
      <div><b>Name:</b> <span style="${hand}">${esc(d.who.name)}</span> &nbsp; <b>Age/Sex:</b> <span style="${hand}">${d.who.age}/${d.who.sex}</span></div>
      <div><b>Date:</b> <span style="${hand}">${esc(d.date)}</span></div></div>
    ${d.vitals ? `<div style="margin-bottom:6px;${hand}">${esc(d.vitals)}</div>` : ""}
    <div style="margin:6px 0 10px"><b>Diagnosis:</b> <span style="${hand}">${esc(d.dx)}</span></div>
    <div style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:#0f6e6e">&#8478;</div>
    <ol style="margin:4px 0 0 22px;${hand}">
      ${d.meds.map(([m, f, dur, note]) => `<li style="margin:7px 0"><b style="font-weight:${d.hand ? 400 : 700}">${esc(m)}</b> &nbsp;&nbsp; ${esc(f)} &nbsp;&nbsp; ${esc(dur)}${note ? `<div style="color:${d.hand ? "#1b2f80" : "#555"};font-size:${d.hand ? 15 : 11.5}px">${esc(note)}</div>` : ""}</li>`).join("")}
    </ol>
    <div style="margin-top:14px"><b>Advice:</b> <span style="${hand}">${esc(d.advice)}</span></div>
    <div style="margin-top:26px;text-align:right"><div class="sig">${esc(d.doctor.replace("Dr. ", ""))}</div><div style="font-weight:700">${esc(d.doctor)}</div></div>
    ${FOOT}</div>`;
}

function flag(value, range) {
  const v = Number(value);
  const between = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (between) return v < Number(between[1]) ? "L" : v > Number(between[2]) ? "H" : "";
  const lt = range.match(/<\s*([\d.]+)/);
  if (lt) return v >= Number(lt[1]) ? "H" : "";
  const gt = range.match(/>\s*([\d.]+)/);
  if (gt) return v <= Number(gt[1]) ? "L" : "";
  return "";
}

function lab(d) {
  return `<div class="page">${letterhead(d, "#8a1538")}
    <table style="margin:14px 0;font-size:12px"><tr>
      <td><b>Patient:</b> ${esc(d.who.name)}</td><td><b>Age/Sex:</b> ${d.who.age} Y / ${d.who.sex === "M" ? "Male" : "Female"}</td><td><b>Lab No:</b> ${esc(d.labNo)}</td></tr>
      <tr><td><b>Ref. by:</b> ${esc(d.refBy)}</td><td><b>Collected:</b> ${esc(d.date)} 08:10</td><td><b>Reported:</b> ${esc(d.date)} 14:30</td></tr></table>
    ${d.sections.map((s) => `
      <div style="background:#f3eef0;padding:6px 10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11.5px;margin-top:12px">${esc(s.title)}</div>
      <table style="font-size:12.5px"><thead><tr style="text-align:left;border-bottom:1.5px solid #333">
        <th style="padding:7px 8px">Test Name</th><th style="padding:7px 8px">Result</th><th style="padding:7px 8px">Unit</th><th style="padding:7px 8px">Biological Ref. Interval</th></tr></thead>
        <tbody>${s.rows.map(([t, v, u, r]) => { const f = flag(v, r); return `<tr style="border-bottom:1px solid #e3e3e3">
          <td style="padding:7px 8px">${esc(t)}</td><td style="padding:7px 8px;font-weight:${f ? 700 : 400}">${esc(v)}${f ? ` <span style="font-size:10px">${f}</span>` : ""}</td>
          <td style="padding:7px 8px">${esc(u)}</td><td style="padding:7px 8px">${esc(r)}</td></tr>`; }).join("")}</tbody></table>`).join("")}
    <div style="margin-top:22px;font-size:11px;color:#555">*** End of report ***</div>
    <div style="margin-top:16px;text-align:right"><div class="sig">${esc(d.pathologist.split(",")[0].replace("Dr. ", ""))}</div><div style="font-weight:700">${esc(d.pathologist)}</div></div>
    ${FOOT}</div>`;
}

function discharge(d) {
  return `<div class="page">${letterhead(d, "#14507a")}
    <h1 style="text-align:center;font-size:17px;letter-spacing:.08em;margin:14px 0">DISCHARGE SUMMARY</h1>
    <table style="font-size:12px;margin-bottom:10px"><tr><td><b>Name:</b> ${esc(d.who.name)}</td><td><b>Age/Sex:</b> ${d.who.age}/${d.who.sex}</td><td><b>IP No:</b> ${esc(d.ipNo)}</td></tr>
      <tr><td><b>Admitted:</b> ${esc(d.admitted)}</td><td><b>Discharged:</b> ${esc(d.discharged)}</td><td><b>Consultant:</b> ${esc(d.consultant)}</td></tr></table>
    <h2 style="font-size:13px;margin-top:10px">Final Diagnosis</h2><ol style="margin-left:20px">${d.dx.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    <h2 style="font-size:13px;margin-top:10px">Course in Hospital</h2><p>${esc(d.course)}</p>
    <h2 style="font-size:13px;margin-top:10px">Investigations</h2>
    <table style="font-size:12px">${d.investigations.map(([t, v, dt]) => `<tr style="border-bottom:1px solid #e3e3e3"><td style="padding:4px 6px">${esc(t)}</td><td style="padding:4px 6px"><b>${esc(v)}</b></td><td style="padding:4px 6px">${esc(dt)}</td></tr>`).join("")}</table>
    <h2 style="font-size:13px;margin-top:10px">Medications on Discharge</h2>
    <table style="font-size:12px">${d.meds.map(([m, f, dur]) => `<tr style="border-bottom:1px solid #e3e3e3"><td style="padding:4px 6px"><b>${esc(m)}</b></td><td style="padding:4px 6px">${esc(f)}</td><td style="padding:4px 6px">${esc(dur)}</td></tr>`).join("")}</table>
    <h2 style="font-size:13px;margin-top:10px">Follow-up</h2><p>${esc(d.followUp)}</p>
    <div style="margin-top:18px;text-align:right"><div class="sig">${esc(d.consultant.split(",")[0].replace("Dr. ", ""))}</div><div style="font-weight:700">${esc(d.consultant)}</div></div>
    ${FOOT}</div>`;
}

function scan(d) {
  return `<div class="page">${letterhead(d, "#14507a")}
    <h1 style="text-align:center;font-size:17px;margin:14px 0">${esc(d.title)}</h1>
    <p><b>Name:</b> ${esc(d.who.name)} &nbsp; <b>Age/Sex:</b> ${d.who.age}/${d.who.sex} &nbsp; <b>Date:</b> ${esc(d.date)}</p>
    <h2 style="font-size:13px;margin-top:12px">Findings</h2><ul style="margin-left:20px">${d.findings.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    <h2 style="font-size:13px;margin-top:12px">Impression</h2><p><b>${esc(d.impression)}</b></p>
    <div style="margin-top:22px;text-align:right"><div class="sig">${esc(d.doctor.split(",")[0].replace("Dr. ", ""))}</div><div style="font-weight:700">${esc(d.doctor)}</div></div>
    ${FOOT}</div>`;
}

const render = { rx, lab, discharge, scan };

// ONLY=file1,file2 rebuilds just those documents and leaves the rest untouched.
const only = process.env.ONLY?.split(",");
if (!only) await rm(OUT, { recursive: true, force: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
for (const d of documents.filter((x) => !only || only.includes(x.file))) {
  const dir = `${OUT}${d.patient}/`;
  await mkdir(dir, { recursive: true });
  const small = d.kind === "rx";
  await page.setViewportSize(small ? { width: 620, height: 880 } : { width: 794, height: 1123 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@400&display=block"><style>${base}</style></head><body>${render[d.kind](d)}</body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (process.env.PREVIEW) await page.locator(".page").screenshot({ path: `/tmp/ct-tools/preview-${d.file}.png` });
  if (d.as === "pdf") {
    await page.pdf({ path: `${dir}${d.file}.pdf`, format: small ? "A5" : "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
  } else {
    const raw = `${dir}${d.file}.raw.png`;
    await page.locator(".page").screenshot({ path: raw });
    // Phone-photo look: slight tilt, soft shadow on a table top, mild noise and JPEG compression.
    execFileSync("magick", [raw, "-resize", "1100x", "-bordercolor", "#fbfaf6", "-border", "6",
      "(", "+clone", "-background", "#00000070", "-shadow", "70x14+10+16", ")", "+swap", "-background", "none", "-layers", "merge", "+repage",
      "-background", "#8c7a63", "-rotate", d.hand ? "-3.2" : "2.1", "-bordercolor", "#8c7a63", "-border", "70",
      "-blur", "0x0.6", "-modulate", "97,94", "-quality", "74", `${dir}${d.file}.jpg`]);
    await rm(raw);
  }
  console.log("built", d.patient, d.file, d.as);
}
await browser.close();
await writeFile(`${OUT}README.md`, "# Demo documents\n\nSimulated prescriptions, lab reports, discharge summaries and a scan report for the three CareTrail demo patients (Ravi Kumar, Lakshmi Iyer, Arun Prakash), generated by `scripts/demo-docs/build.mjs`. All clinics, doctors, patients and values are fictional. `fresh/` holds a prescription kept aside for the live upload in the demo video.\n");
