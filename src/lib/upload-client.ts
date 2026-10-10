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
