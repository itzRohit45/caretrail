import { ArrowRight, Stethoscope, Siren } from "@phosphor-icons/react/ssr";
import { startDemo } from "@/app/demo/actions";
import { DEMO_PATIENTS, type DemoKey } from "@/lib/demo";
import { cn } from "@/lib/cn";

/** Judges and first-time visitors: log in as a sample patient, or open the doctor's and emergency views. */
export function DemoPanel({ compact }: { compact?: boolean }) {
  return (
    <div className="space-y-4">
      <ul className={cn("grid gap-3", !compact && "md:grid-cols-3")}>
        {(Object.keys(DEMO_PATIENTS) as DemoKey[]).map((key, i) => {
          const p = DEMO_PATIENTS[key];
          return (
            <li key={key}>
              <form action={startDemo}>
                <input type="hidden" name="patient" value={key} />
                <button
                  type="submit"
                  className={cn(
                    "group flex w-full flex-col items-start gap-1 rounded-card border p-4 text-left transition-colors duration-150 active:scale-[0.99]",
                    i === 0 ? "border-primary bg-primary text-on-primary hover:bg-primary-strong" : "border-rule bg-sheet hover:border-rule-strong",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2 text-lead font-bold">
                    Try as {p.name.split(" ")[0]}
                    <ArrowRight aria-hidden weight="bold" className="size-5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <span className={cn("text-dense", i === 0 ? "text-on-primary" : "text-ink-2")}>{p.name}, {p.line}</span>
                  {!compact ? <span className={cn("mt-1 text-meta", i === 0 ? "text-on-primary" : "text-ink-3")}>{p.shows}</span> : null}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href="/demo/doctor" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-rule-strong bg-sheet px-4 font-semibold text-ink hover:border-ink">
          <Stethoscope aria-hidden weight="duotone" className="size-5 text-primary" /> Open a doctor&apos;s view
        </a>
        <a href="/demo/emergency" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-rule-strong bg-sheet px-4 font-semibold text-ink hover:border-ink">
          <Siren aria-hidden weight="duotone" className="size-5 text-primary" /> Open an emergency card
        </a>
      </div>
      <p className="text-meta text-ink-3">Sample patients are simulated. Each try gets a private copy, so you can upload, share and revoke freely.</p>
    </div>
  );
}
