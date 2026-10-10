// Browser-side upload helpers shared by the patient uploader and the doctor's write-back.

/** Fingerprint computed on the device, re-checked by the server after upload. */
export async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Straight to private storage through a signed URL, with progress. */
export function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

// Phone photos are shrunk on the device before upload: a 4 MB photo becomes a few hundred KB, which
// uploads quickly on mobile data and reads faster. 2200 px on the long side keeps handwriting legible.
const MAX_EDGE = 2200;
const KEEP_BELOW_BYTES = 1.5 * 1048576;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= KEEP_BELOW_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "white"; // transparent PNG areas become paper, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

/** Several photos and/or PDFs of one report become one PDF, one page per photo, in the order chosen. */
export async function combinePages(files: File[], name: string): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  // No metadata dates, so the same pages always give the same file (duplicate check by fingerprint).
  const out = await PDFDocument.create({ updateMetadata: false });
  for (const f of files) {
    if (f.type === "application/pdf") {
      const src = await PDFDocument.load(await f.arrayBuffer(), { updateMetadata: false });
      for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
      continue;
    }
    const photo = await shrinkPhoto(f);
    const bytes = await photo.arrayBuffer();
    const image = photo.type === "image/png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const width = 595; // A4 width in points; height follows the photo
    const height = (image.height / image.width) * width;
    out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  const bytes = await out.save();
  return new File([new Blob([bytes as BlobPart])], name, { type: "application/pdf" });
}

export type ConsultationNotes = { date: string; doctor: string; clinic: string; notes: string };

/**
 * Typed consultation notes become a real text PDF (page 1), so they are read, stored, shared and
 * highlighted exactly like an uploaded document. Characters the PDF font cannot draw become "?".
 */
export async function notesToPdf(n: ConsultationNotes): Promise<File> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = (t: string) => t.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
  const [W, H, M, SIZE, LINE] = [595, 842, 56, 12, 17];
  let page = doc.addPage([W, H]);
  let y = H - M;
  const write = (text: string, f = font, size = SIZE) => {
    if (y < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
    page.drawText(text, { x: M, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
    y -= size === SIZE ? LINE : size + 8;
  };
  const wrap = (text: string) => {
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, SIZE) > W - 2 * M && line) {
          write(line);
          line = word;
        } else line = next;
      }
      write(line);
    }
  };
  const [yyyy, mm, dd] = n.date.split("-");
  write("Consultation notes", bold, 18);
  if (n.date) write(`Date: ${dd}/${mm}/${yyyy}`);
  if (n.doctor.trim()) write(`Doctor: ${clean(n.doctor.trim())}`);
  if (n.clinic.trim()) write(`Clinic: ${clean(n.clinic.trim())}`);
  y -= 8;
  wrap(n.notes.trim());
  y -= 8;
  write("Typed by the patient in CareTrail.", font, 10);
  const bytes = await doc.save();
  return new File([new Blob([bytes as BlobPart])], "Consultation notes.pdf", { type: "application/pdf" });
}
