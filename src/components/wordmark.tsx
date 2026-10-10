import { cn } from "@/lib/cn";

/** Logo: a two-tone capsule (medicines) leaving a fading trail (your health history), and the name. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-brand-mark" />
      <g transform="rotate(45 18.6 13.4)">
        <path d="M14.6 13 V9.6 A4 4 0 0 1 22.6 9.6 V13 Z" className="fill-brand-mark-white" />
        <path d="M14.6 13.8 V17.2 A4 4 0 0 0 22.6 17.2 V13.8 Z" className="fill-brand-mark-light" />
      </g>
      <circle cx="10.6" cy="21.4" r="1.45" className="fill-brand-mark-light" />
      <circle cx="7.9" cy="24.1" r="1.1" className="fill-brand-mark-light" opacity="0.75" />
      <circle cx="5.7" cy="26.3" r="0.8" className="fill-brand-mark-light" opacity="0.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-title font-bold text-ink", className)}>
      <LogoMark />
      CareTrail
    </span>
  );
}
