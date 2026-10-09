import { WarningOctagon, Warning, Info } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

type Tone = "severe" | "caution" | "info";

const tones: Record<Tone, { cls: string; Icon: typeof Info; iconCls: string }> = {
  severe: { cls: "bg-severe-soft border-severe-rule", Icon: WarningOctagon, iconCls: "text-severe" },
  caution: { cls: "bg-sheet border-rule-strong", Icon: Warning, iconCls: "text-ink" },
  info: { cls: "bg-primary-soft border-transparent", Icon: Info, iconCls: "text-primary" },
};

export function Alert({
  tone,
  title,
  children,
  className,
  role,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { cls, Icon, iconCls } = tones[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-card border p-4", cls, className)}>
      <Icon aria-hidden weight="fill" className={cn("mt-0.5 size-6 shrink-0", iconCls)} />
      <div className="min-w-0 space-y-1">
        <p className={cn("font-bold", tone === "severe" ? "text-severe" : "text-ink")}>{title}</p>
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
    </div>
  );
}

export const SAFETY_NOTE = "Discuss with your doctor; do not stop medicines on your own.";
