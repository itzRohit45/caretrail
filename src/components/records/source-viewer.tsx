"use client";

import { useEffect, useRef, useState } from "react";
import { Quotes, WarningCircle } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

type Box = { left: number; top: number; width: number; height: number };

/**
 * The original document with the fact's source text highlighted.
 * PDFs: pdf.js text layer search, boxes drawn over the matching words. Images: the quote beside the image.
 */
export function SourceViewer({ url, mimeType, quote }: { url: string; mimeType: string; quote: string | null }) {
  if (mimeType !== "application/pdf") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img src={url} alt="The original document" className="w-full rounded-card border border-rule" />
        {quote ? <QuoteBox quote={quote} /> : null}
      </div>
    );
  }
  return <PdfWithHighlight url={url} quote={quote} />;
}

function QuoteBox({ quote, note }: { quote: string; note?: string }) {
  return (
    <aside className="h-fit rounded-card border border-verify-rule bg-verify-soft p-4">
      <p className="flex items-center gap-2 text-dense font-bold text-verify">
        <Quotes aria-hidden weight="fill" className="size-5" /> Text on the document
      </p>
      <p className="mt-2 font-mono text-dense text-ink">{quote}</p>
      {note ? <p className="mt-2 text-meta text-ink-2">{note}</p> : null}
    </aside>
  );
}

function PdfWithHighlight({ url, quote }: { url: string; quote: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [found, setFound] = useState<boolean | null>(null);

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
        const target = quote ? norm(quote) : null;
        let firstHit: HTMLElement | null = null;
        for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 2 });
          const wrap = document.createElement("div");
          wrap.className = "relative";
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block w-full bg-sheet";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `Page ${n} of the original document`);
          wrap.appendChild(canvas);
          el.appendChild(wrap);
          await page.render({ canvas, viewport }).promise;
          if (!target || cancelled) continue;

          // Join the page's text items in reading order, remembering which item each character came from.
          const content = await page.getTextContent();
          const items = content.items.filter((i): i is typeof i & { str: string; transform: number[]; width: number; height: number } => "str" in i);
          let text = "";
          const owner: number[] = [];
          items.forEach((it, idx) => {
            const piece = norm(it.str);
            if (!piece) return;
            if (text) {
              text += " ";
              owner.push(idx);
            }
            text += piece;
            for (let k = 0; k < piece.length; k++) owner.push(idx);
          });
          let at = text.indexOf(target);
          let len = target.length;
          if (at < 0 && target.length > 24) {
            at = text.indexOf(target.slice(0, 24));
            len = 24;
          }
          if (at < 0) continue;
          const hitItems = [...new Set(owner.slice(at, at + len))];
          const boxes: Box[] = hitItems.map((idx) => {
            const it = items[idx];
            const h = it.height || Math.hypot(it.transform[2], it.transform[3]);
            const [x1, y1] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
            const [x2, y2] = viewport.convertToViewportPoint(it.transform[4] + it.width, it.transform[5] + h);
            return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
          });
          for (const b of boxes) {
            const mark = document.createElement("div");
            mark.className = "pointer-events-none absolute rounded-sm bg-verify-soft mix-blend-multiply ring-2 ring-verify";
            Object.assign(mark.style, {
              left: `${((b.left - 4) / viewport.width) * 100}%`,
              top: `${((b.top - 3) / viewport.height) * 100}%`,
              width: `${((b.width + 8) / viewport.width) * 100}%`,
              height: `${((b.height + 6) / viewport.height) * 100}%`,
            });
            wrap.appendChild(mark);
            firstHit ??= mark;
          }
        }
        if (cancelled) return;
        setFound(target ? Boolean(firstHit) : null);
        setState("ready");
        firstHit?.scrollIntoView({ block: "center" });
      } catch (err) {
        console.error("source viewer: PDF render failed", err instanceof Error ? err.message : err);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, quote]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="max-h-[78dvh] overflow-auto rounded-card border border-rule bg-sheet-sunk">
        {state === "loading" ? <Skeleton className="aspect-[3/4] w-full" /> : null}
        {state === "error" ? (
          <p className="flex items-center gap-2 p-4 text-ink-2">
            <WarningCircle aria-hidden className="size-5" /> This PDF could not be displayed.
          </p>
        ) : null}
        <div ref={holder} className="divide-y divide-rule" />
      </div>
      {quote ? <QuoteBox quote={quote} note={found === false ? "Exact text not located on the page; compare by eye." : found ? "Highlighted on the page." : undefined} /> : null}
    </div>
  );
}
