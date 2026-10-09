import { cn } from "@/lib/cn";

/** Wordmark: a simple geometric mark (three points joined into a trail) and the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-title font-bold text-ink", className)}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="10" className="fill-primary" />
        <path d="M8 21.5 L14 13 L19 18 L24 10" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="stroke-on-primary" />
        <circle cx="8" cy="21.5" r="2.2" className="fill-on-primary" />
        <circle cx="24" cy="10" r="2.2" className="fill-on-primary" />
      </svg>
      CareTrail
    </span>
  );
}
