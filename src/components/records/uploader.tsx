"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FilePlus, FileText, ImageSquare, CheckCircle, CircleNotch, ArrowCounterClockwise, X, Plus } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { ACCEPTED_TYPES, DOC_TYPES, DOC_TYPE_LABELS, MAX_UPLOAD_BYTES } from "@/lib/schemas/documents";
import { cn } from "@/lib/cn";
import { combinePages, notesToPdf, putWithProgress, sha256, shrinkPhoto, type ConsultationNotes } from "@/lib/upload-client";
import { inputClass } from "@/components/ui/field";
import { todayIST } from "@/lib/format";

type DocType = (typeof DOC_TYPES)[number];
type Phase =
  | { name: "pick" }
  | { name: "hashing" }
  | { name: "uploading"; percent: number }
  | { name: "reading" }
  | { name: "error"; message: string; retry?: boolean; duplicateId?: string };

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const MAX_PAGES = 10;
// Photos are shrunk on the phone before upload, so a large original photo is fine; PDFs are sent as they are.
const MAX_PHOTO_BYTES = 30 * 1048576;

export function Uploader() {
  const router = useRouter();
  const [type, setType] = useState<DocType | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState<ConsultationNotes>(() => ({ date: todayIST(), doctor: "", clinic: "", notes: "" }));
  const typed = type === "consultation_note";
  // Consultation notes can be the whole record; a photo of the prescription is optional.
  const ready = Boolean(type) && (files.length > 0 || (typed && notes.notes.trim().length >= 10));
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  /** Adds pages: several photos of one report, or a PDF. They are kept together as one record. */
  function choose(list: FileList | null) {
    const picked = [...(list ?? [])];
    if (!picked.length) return;
    for (const f of picked) {
      if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) {
        return setPhase({ name: "error", message: `"${f.name}" is not a PDF, JPG or PNG. Please choose one of those.` });
      }
      const limit = f.type === "application/pdf" ? MAX_UPLOAD_BYTES : MAX_PHOTO_BYTES;
      if (f.size > limit) {
        return setPhase({ name: "error", message: `This file is ${mb(f.size)}. Files can be up to 10 MB. Try a smaller PDF or a photo.` });
      }
    }
    if (files.length + picked.length > MAX_PAGES) {
      return setPhase({ name: "error", message: `One record can have up to ${MAX_PAGES} pages. Upload the rest as a second record.` });
    }
    setFiles((current) => [...current, ...picked]);
    setPhase({ name: "pick" });
  }

  async function upload() {
    if (!ready || !type) return;
    try {
      setPhase({ name: "hashing" });
      let file: File;
      try {
        if (typed && notes.notes.trim()) {
          const page = await notesToPdf(notes);
          file = files.length ? await combinePages([page, ...files], `Consultation notes (${files.length + 1} pages).pdf`) : page;
        } else {
          file = files.length === 1 ? await shrinkPhoto(files[0]) : await combinePages(files, `${DOC_TYPE_LABELS[type]} (${files.length} pages).pdf`);
        }
      } catch {
        return setPhase({ name: "error", message: "One of the files could not be opened. A protected PDF or an unusual photo format can cause this; try a photo instead." });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return setPhase({ name: "error", message: `Together these pages are ${mb(file.size)}. Files can be up to 10 MB. Remove a page, or upload them as two records.` });
      }
      const file_hash = await sha256(file);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file_hash, size_bytes: file.size, mime_type: file.type, original_filename: file.name, type }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push(`/login?next=${encodeURIComponent("/upload")}`);
      if (!res.ok) {
        return setPhase({ name: "error", message: body.error?.message ?? "We could not start the upload.", duplicateId: body.error?.duplicate?.id, retry: res.status >= 500 });
      }
      const { document_id, upload_url } = body.data as { document_id: string; upload_url: string };
      setPhase({ name: "uploading", percent: 0 });
      try {
        await putWithProgress(upload_url, file, (percent) => setPhase({ name: "uploading", percent }));
      } catch {
        return setPhase({ name: "error", message: "The upload stopped. Check your internet connection and try again.", retry: true });
      }
      setPhase({ name: "reading" });
      const processed = await fetch(`/api/documents/${document_id}/process`, { method: "POST" });
      const result = await processed.json().catch(() => ({}));
      if (!processed.ok && result.error?.retry_upload) {
        return setPhase({ name: "error", message: result.error.message, retry: true });
      }
      router.push(`/records/${document_id}`);
    } catch {
      setPhase({ name: "error", message: "Something went wrong. Check your connection and try again.", retry: true });
    }
  }

  const busy = phase.name === "hashing" || phase.name === "uploading" || phase.name === "reading";

  if (busy) {
    const steps = [
      { label: typed && notes.notes.trim() ? "Preparing your notes" : files.length > 1 ? `Putting ${files.length} pages together` : "Preparing the file", done: phase.name !== "hashing" },
      { label: phase.name === "uploading" ? `Uploading, ${phase.percent}%` : "Uploading", done: phase.name === "reading" },
      { label: "Reading your document", done: false },
    ];
    const current = steps.findIndex((s) => !s.done);
    return (
      <section aria-live="polite" className="rounded-card border border-rule bg-sheet p-6 sm:p-8">
        <h2 className="text-title font-bold">{phase.name === "reading" ? "Reading your document" : "Uploading your record"}</h2>
        <p className="mt-1 text-ink-2">
          {phase.name === "reading" ? "This usually takes 5 to 15 seconds. Please keep this page open." : "Please keep this page open."}
        </p>
        {phase.name === "uploading" ? (
          <div className="mt-5 h-2 overflow-hidden rounded-pill bg-sheet-sunk" role="progressbar" aria-valuenow={phase.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
            <div className="h-full rounded-pill bg-primary transition-[width] duration-150" style={{ width: `${phase.percent}%` }} />
          </div>
        ) : null}
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.label} className={cn("flex items-center gap-3", i > current && "text-ink-3")}>
              {s.done ? (
                <CheckCircle aria-hidden weight="fill" className="size-6 text-verified" />
              ) : i === current ? (
                <CircleNotch aria-hidden weight="bold" className="size-6 animate-spin text-primary" />
              ) : (
                <span aria-hidden className="size-6 rounded-pill border-2 border-rule" />
              )}
              <span className={cn("font-semibold", i === current && "text-ink")}>{s.label}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="kind-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-7">
        <h2 id="kind-title" className="text-title font-bold">What is it?</h2>
        <div role="radiogroup" aria-labelledby="kind-title" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                "min-h-14 rounded-control border px-3 font-semibold transition-colors duration-150",
                type === t ? "border-primary bg-primary text-on-primary" : "border-rule-strong bg-sheet text-ink hover:border-ink",
              )}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      {typed ? (
        <section aria-labelledby="notes-title" className="space-y-4 rounded-card border border-rule bg-sheet p-5 sm:p-7">
          <div>
            <h2 id="notes-title" className="text-title font-bold">Write the notes</h2>
            <p className="mt-1 text-ink-2">What the doctor told you. CareTrail reads it like a document, and you check what it found.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cn-date" className="mb-1 block font-semibold">Date of the visit</label>
              <input id="cn-date" type="date" max={todayIST()} value={notes.date} onChange={(e) => setNotes({ ...notes, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cn-doctor" className="mb-1 block font-semibold">Doctor <span className="font-normal text-ink-3">(optional)</span></label>
              <input id="cn-doctor" value={notes.doctor} maxLength={80} onChange={(e) => setNotes({ ...notes, doctor: e.target.value })} autoComplete="off" className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="cn-clinic" className="mb-1 block font-semibold">Clinic or hospital <span className="font-normal text-ink-3">(optional)</span></label>
            <input id="cn-clinic" value={notes.clinic} maxLength={120} onChange={(e) => setNotes({ ...notes, clinic: e.target.value })} autoComplete="off" className={inputClass} />
          </div>
          <div>
            <label htmlFor="cn-notes" className="mb-1 block font-semibold">Notes</label>
            <p id="cn-notes-help" className="mb-2 text-dense text-ink-2">For example: Diagnosis: viral fever. Tab Dolo 650 mg 1-0-1 for 3 days. Review after 1 week.</p>
            <textarea id="cn-notes" rows={7} maxLength={4000} value={notes.notes} onChange={(e) => setNotes({ ...notes, notes: e.target.value })} aria-describedby="cn-notes-help" className={cn(inputClass, "min-h-40 py-3")} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="file-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-7">
        <h2 id="file-title" className="text-title font-bold">{typed ? "Photo of the prescription (optional)" : "Add the file"}</h2>
        <p className="mt-1 text-ink-2">{typed ? "If the doctor also wrote a prescription, add a photo. It is kept with your notes." : "A clear photo or a PDF. Several pages? Add a photo of each page; they stay together as one record."}</p>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
        <input ref={picker} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />

        {files.length ? (
          <>
            {files.length > 1 ? <p className="mt-5 font-semibold">{files.length} pages, uploaded as one record in this order</p> : null}
            <ol className={cn("space-y-2", files.length > 1 ? "mt-2" : "mt-5")}>
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-3 rounded-control border border-rule bg-sheet-sunk p-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-sheet text-primary">
                    {f.type === "application/pdf" ? <FileText aria-hidden className="size-6" /> : <ImageSquare aria-hidden className="size-6" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{files.length > 1 ? `Page ${i + 1}: ` : ""}{f.name}</p>
                    <p className="text-dense text-ink-2">{mb(f.size)}</p>
                  </div>
                  <button type="button" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} className={buttonClass("quiet", "dense")} aria-label={`Remove ${f.name}`}>
                    <X aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
            </ol>
            {files.length < MAX_PAGES ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => camera.current?.click()} className={buttonClass("secondary", "dense")}>
                  <Camera aria-hidden className="size-5" /> Photo of next page
                </button>
                <button type="button" onClick={() => picker.current?.click()} className={buttonClass("secondary", "dense")}>
                  <Plus aria-hidden className="size-5" /> Add more files
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => camera.current?.click()} className={buttonClass("secondary", "patient", "min-h-16 justify-start rounded-control")}>
              <Camera aria-hidden weight="duotone" className="size-7 text-primary" />
              Take a photo
            </button>
            <button type="button" onClick={() => picker.current?.click()} className={buttonClass("secondary", "patient", "min-h-16 justify-start rounded-control")}>
              <FilePlus aria-hidden weight="duotone" className="size-7 text-primary" />
              Choose files
            </button>
          </div>
        )}
      </section>

      {phase.name === "error" ? (
        <div role="alert" className="rounded-card border border-severe-rule bg-severe-soft p-4">
          <p className="font-bold text-severe">{phase.message}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {phase.duplicateId ? (
              <Link href={`/records/${phase.duplicateId}`} className={buttonClass("secondary", "dense")}>
                Open it
              </Link>
            ) : null}
            {phase.retry && ready ? (
              <button type="button" onClick={upload} className={buttonClass("secondary", "dense")}>
                <ArrowCounterClockwise aria-hidden className="size-5" />
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={upload} disabled={!ready} className={buttonClass("primary")}>
          {typed && !files.length ? "Save notes" : "Upload record"}
        </button>
        {!ready ? <p className="text-ink-2">{!type ? "Choose what it is first." : typed ? "Write the notes (or add a photo)." : "Then add the file."}</p> : null}
      </div>
    </div>
  );
}
