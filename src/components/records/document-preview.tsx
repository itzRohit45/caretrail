"use client";

import { useEffect, useRef, useState } from "react";
import { WarningCircle, ArrowSquareOut, CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonClass } from "@/components/ui/button";

type FileInfo = { url: string; mime_type: string };

/**
 * Fetches a 5-minute signed URL and shows the original: images directly, PDFs through pdf.js.
 * `collapsible`: folded behind a toggle on phones, always open from the lg breakpoint.
 */
export function DocumentPreview({ documentId, collapsible }: { documentId: string; collapsible?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!collapsible) return <Preview documentId={documentId} />;
  return (
    <div className="rounded-card border border-rule bg-sheet p-3 lg:border-0 lg:bg-transparent lg:p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(buttonClass("quiet", "dense"), "w-full justify-between lg:hidden")}
      >
        {open ? "Hide the document" : "Show the document"}
        <CaretDown aria-hidden className={cn("size-5 transition-transform duration-150", open && "rotate-180")} />
      </button>
      <div className={cn(open ? "mt-3 block" : "hidden", "lg:mt-0 lg:block")}>
        <Preview documentId={documentId} />
      </div>
    </div>
  );
}

function Preview({ documentId }: { documentId: string }) {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/documents/${documentId}/file`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => live && setInfo(b.data))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [documentId]);

  if (error)
    return (
      <p className="flex items-center gap-2 rounded-card bg-sheet-sunk p-4 text-ink-2">
        <WarningCircle aria-hidden className="size-5" /> The original could not be shown. Refresh the page to try again.
      </p>
    );
  if (!info) return <Skeleton className="aspect-[3/4] w-full rounded-card" />;
  return (
    <div className="space-y-2">
      <div className="max-h-[75dvh] overflow-auto rounded-card border border-rule bg-sheet-sunk">
        {info.mime_type === "application/pdf" ? (
          <PdfPages url={info.url} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
          <img src={info.url} alt="The original document you uploaded" className="w-full" />
        )}
      </div>
      <a href={info.url} target="_blank" rel="noreferrer" className={buttonClass("quiet", "dense")}>
        <ArrowSquareOut aria-hidden className="size-5" />
        Open full size
      </a>
    </div>
  );
}

function PdfPages({ url }: { url: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ url }).promise;
        const el = holder.current;
        if (!el || cancelled) return;
        el.replaceChildren();
        for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block w-full bg-sheet";
          canvas.setAttribute("aria-label", `Page ${n} of the original document`);
          canvas.setAttribute("role", "img");
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <>
      {state === "loading" ? <Skeleton className="aspect-[3/4] w-full" /> : null}
      {state === "error" ? <p className="p-4 text-ink-2">This PDF could not be displayed here. Use &quot;Open full size&quot;.</p> : null}
      <div ref={holder} className="divide-y divide-rule" />
    </>
  );
}
