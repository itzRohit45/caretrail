import { CheckCircle, Question, UserCheck, ClockCounterClockwise, Stethoscope } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

type Tone = "verified" | "patient-verified" | "needs-check" | "unrecognised" | "recent" | "doctor-added";

const tones: Record<Tone, { cls: string; Icon: typeof CheckCircle; label: string }> = {
  verified: { cls: "bg-verified-soft text-verified", Icon: CheckCircle, label: "Verified" },
  "patient-verified": { cls: "bg-verified-soft text-verified", Icon: UserCheck, label: "Patient-verified" },
  "needs-check": { cls: "bg-verify-soft text-verify", Icon: Question, label: "Needs check" },
  unrecognised: { cls: "bg-sheet-sunk text-ink-2", Icon: Question, label: "Unrecognised" },
  recent: { cls: "bg-primary-soft text-primary", Icon: ClockCounterClockwise, label: "Recent" },
  "doctor-added": { cls: "bg-primary-soft text-primary", Icon: Stethoscope, label: "Added by your doctor" },
};

/** Status always shows icon + word, never colour alone. */
export function Badge({ tone, children, className }: { tone: Tone; children?: React.ReactNode; className?: string }) {
  const { cls, Icon, label } = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-meta font-semibold", cls, className)}>
      <Icon aria-hidden className="size-4 shrink-0" weight="bold" />
      {children ?? label}
    </span>
  );
}
