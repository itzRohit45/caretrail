"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { DownloadSimple, Printer, ArrowsClockwise, CheckCircle, WarningOctagon, CircleNotch, QrCode } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

type Facts = { name: string; blood_group: string | null; allergies: string[]; contact: string | null };

/** Create or replace the emergency QR, then save it as a lock-screen image or print it as a wallet card. */
export function EmergencyQrManager({ activeSince, facts }: { activeSince: string | null; facts: Facts }) {
  const [url, setUrl] = useState<string | null>(null);
  const [since, setSince] = useState(activeSince);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrCanvas = useRef<HTMLDivElement>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/emergency/token", { method: "POST" }).catch(() => null);
    setBusy(false);
    setConfirm(false);
    if (!res?.ok) return setError("Your emergency QR could not be created. Check your connection and try again.");
    setUrl((await res.json()).data.url);
    setSince(new Date().toISOString());
  }

  function downloadLockScreen() {
    const qr = qrCanvas.current?.querySelector("canvas");
    if (!qr) return;
    const W = 1170;
    const H = 2532;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0b0c0e";
    g.fillRect(0, 0, W, H);
    // Card sits below the lock-screen clock.
    const cx = 110, cy = 980, cw = W - 220, ch = 1180;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(cx, cy, cw, ch, 48);
    g.fill();
    g.fillStyle = "#a11b12";
    g.beginPath();
    g.roundRect(cx, cy, cw, 150, [48, 48, 0, 0]);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 64px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("MEDICAL EMERGENCY", W / 2, cy + 98);
    g.drawImage(qr, (W - 640) / 2, cy + 200, 640, 640);
    g.fillStyle = "#0b0c0e";
    g.font = "bold 56px system-ui, sans-serif";
    g.fillText("Scan for allergies, medicines", W / 2, cy + 940);
    g.fillText("and emergency contact", W / 2, cy + 1010);
    g.font = "600 46px system-ui, sans-serif";
    g.fillText(`${facts.name}${facts.blood_group ? `  ·  Blood ${facts.blood_group}` : ""}`, W / 2, cy + 1100);
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "caretrail-emergency-lockscreen.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  return (
    <section aria-labelledby="qr-title" className="rounded-card border border-rule bg-sheet p-5 sm:p-7">
      <h2 id="qr-title" className="text-title font-bold">Emergency QR</h2>
      {url ? (
        <div className="mt-4 grid items-start gap-6 md:grid-cols-[auto_1fr]">
          <div role="img" aria-label="Your emergency QR code" className="justify-self-center rounded-card border border-rule bg-sheet p-4">
            <QRCodeSVG value={url} size={200} level="M" marginSize={0} aria-hidden />
          </div>
          <div ref={qrCanvas} className="hidden" aria-hidden>
            <QRCodeCanvas value={url} size={640} level="M" marginSize={2} />
          </div>
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-semibold text-verified"><CheckCircle aria-hidden weight="fill" className="size-6" /> Your emergency QR is ready</p>
            <p className="text-ink-2">Anyone who scans it sees only your blood group, allergies, current medicines, main conditions and emergency contact. You are told each time it is scanned.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadLockScreen} className={buttonClass("primary", "dense")}>
                <DownloadSimple aria-hidden weight="bold" className="size-5" /> Save lock-screen image
              </button>
              <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "dense")}>
                <Printer aria-hidden className="size-5" /> Print wallet card
              </button>
            </div>
            <p className="flex items-start gap-2 rounded-control bg-verify-soft px-3 py-2 text-dense text-verify">
              <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
              Save or print it now. For your safety the QR is shown only once; if you lose it, make a new one.
            </p>
          </div>
          <div id="wallet-card" className="hidden print:block" aria-hidden>
            <div style={{ width: "85.6mm", height: "54mm" }} className="emergency-surface flex gap-3 rounded-[3mm] border border-ink bg-sheet p-[3mm] text-[8pt] leading-tight text-ink">
              <QRCodeSVG value={url} size={150} level="M" marginSize={0} style={{ width: "28mm", height: "28mm" }} />
              <div className="min-w-0">
                <p className="text-[9pt] font-bold">MEDICAL INFO: SCAN IN AN EMERGENCY</p>
                <p className="mt-[1mm] text-[11pt] font-bold">{facts.name}</p>
                <p>Blood group: <b>{facts.blood_group ?? "not recorded"}</b></p>
                <p>Allergies: <b>{facts.allergies.length ? facts.allergies.join(", ") : "none recorded"}</b></p>
                {facts.contact ? <p>Emergency contact: <b>{facts.contact}</b></p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {since ? (
            <p className="flex items-start gap-2 text-ink-2">
              <QrCode aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
              <span>Your emergency QR has been active since <span className="font-semibold text-ink">{formatDateTime(since)}</span>. Lost it? Make a new one. The old one will stop working immediately.</span>
            </p>
          ) : (
            <p className="text-ink-2">Put a QR on your lock screen and in your wallet. If you cannot speak, emergency staff scan it with any phone and see what matters, without logging in.</p>
          )}
          {since && confirm ? (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-rule-strong p-3">
              <p className="font-semibold">Replace your emergency QR? Printed cards with the old QR will stop working.</p>
              <button type="button" disabled={busy} onClick={create} className={buttonClass("primary", "dense")}>
                {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : null} Yes, make a new QR
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={buttonClass("quiet", "dense")}>Keep the current one</button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => (since ? setConfirm(true) : create())} className={buttonClass(since ? "secondary" : "primary")}>
              {busy ? <CircleNotch aria-hidden className="size-5 animate-spin" /> : since ? <ArrowsClockwise aria-hidden className="size-5" /> : <QrCode aria-hidden weight="bold" className="size-5" />}
              {since ? "Make a new QR" : "Create my emergency QR"}
            </button>
          )}
          {error ? <p role="alert" className="font-semibold text-severe">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
