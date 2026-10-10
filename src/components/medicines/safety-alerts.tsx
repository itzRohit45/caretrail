import Link from "next/link";
import { WarningOctagon, Warning, Info, FileText, ShieldCheck } from "@phosphor-icons/react/ssr";
import { SAFETY_NOTE, type SafetyWarning } from "@/lib/safety/engine";
import { cn } from "@/lib/cn";

function Sources({ w }: { w: SafetyWarning }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {w.items.map((i) => (
        <li key={i.medicationId}>
          <Link href={`/records/${i.documentId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-rule bg-sheet px-3 text-dense font-semibold text-primary hover:border-rule-strong">
            <FileText aria-hidden className="size-4 shrink-0" />
            <span>
              {i.brand}
              {i.prescriber ? <span className="font-normal text-ink-2">, {i.prescriber}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function WarningCard({ w, flat }: { w: SafetyWarning; flat?: boolean }) {
  const severe = w.level === "severe";
  const Icon = severe ? WarningOctagon : w.level === "caution" ? Warning : Info;
  return (
    <li className={cn(flat ? "py-4 first:pt-1" : "rounded-card border p-4 sm:p-5", !flat && (severe ? "border-severe-rule bg-severe-soft" : "border-rule bg-sheet"))}>
      <p className={cn("flex items-start gap-2 font-bold", severe ? "text-severe" : "text-ink")}>
        <Icon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
        <span>
          <span className="sr-only">{severe ? "Severe warning: " : w.level === "caution" ? "Caution: " : "Note: "}</span>
          {w.title}
        </span>
      </p>
      <p className="mt-1 text-ink-2">{w.detail}</p>
      <Sources w={w} />
    </li>
  );
}

/** Full safety section for the medicines page. */
export function SafetyAlerts({ warnings, unrecognised }: { warnings: SafetyWarning[]; unrecognised: string[] }) {
  const severe = warnings.filter((w) => w.level === "severe");
  const caution = warnings.filter((w) => w.level === "caution");
  const info = warnings.filter((w) => w.level === "info");
  const duplicates = caution.filter((w) => w.kind === "duplicate");
  const moderate = caution.filter((w) => w.kind !== "duplicate");

  return (
    <section aria-labelledby="safety-title" className="space-y-4">
      <h2 id="safety-title" className="text-title font-bold">Safety checks</h2>
      {warnings.length === 0 ? (
        <p className="flex items-start gap-3 rounded-card border border-verified-rule bg-verified-soft p-4 text-ink">
          <ShieldCheck aria-hidden weight="fill" className="mt-0.5 size-6 shrink-0 text-verified" />
          <span>
            <span className="font-bold">No warnings found for your current medicines.</span> Checks cover duplicate medicines, your recorded allergies and the interactions in the DDInter dataset.
          </span>
        </p>
      ) : (
        <>
          {severe.length ? <ul className="space-y-3">{severe.map((w) => <WarningCard key={w.id} w={w} />)}</ul> : null}
          {duplicates.length || moderate.length ? (
            <div className="space-y-3">
              <h3 className="text-lead font-bold">To discuss with your doctor</h3>
              {duplicates.length ? <ul className="space-y-3">{duplicates.map((w) => <WarningCard key={w.id} w={w} />)}</ul> : null}
              {moderate.length === 1 ? (
                <ul>{moderate.map((w) => <WarningCard key={w.id} w={w} />)}</ul>
              ) : moderate.length ? (
                <details className="group rounded-card border border-rule bg-sheet p-4 sm:p-5" open={moderate.length <= 2}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 font-bold">
                    <Warning aria-hidden weight="fill" className="size-5" />
                    {moderate.length} moderate interaction{moderate.length > 1 ? "s" : ""}
                    <span className="ml-auto text-dense font-semibold text-primary group-open:hidden">Show</span>
                  </summary>
                  <ul className="mt-2 divide-y divide-rule">{moderate.map((w) => <WarningCard key={w.id} w={w} flat />)}</ul>
                </details>
              ) : null}
            </div>
          ) : null}
          {info.length ? (
            <details className="group rounded-card border border-rule bg-sheet p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink-2">
                <Info aria-hidden className="size-5" /> {info.length} minor interaction{info.length > 1 ? "s" : ""}, usually not a concern
                <span className="ml-auto text-dense text-primary group-open:hidden">Show</span>
              </summary>
              <ul className="mt-2 divide-y divide-rule">{info.map((w) => <WarningCard key={w.id} w={w} flat />)}</ul>
            </details>
          ) : null}
          <p className="flex items-start gap-2 font-semibold text-ink">
            <Info aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-primary" />
            {SAFETY_NOTE}
          </p>
        </>
      )}
      {unrecognised.length ? (
        <p className="text-dense text-ink-2">
          Not checked for interactions because we do not recognise the name: {unrecognised.join(", ")}. They are kept exactly as written.
        </p>
      ) : null}
    </section>
  );
}
