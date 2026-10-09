import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "patient" | "dense";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong",
  secondary: "bg-sheet text-ink border border-rule-strong hover:border-ink-3 hover:bg-sheet-sunk",
  quiet: "text-primary hover:bg-primary-soft",
  danger: "bg-sheet text-severe border border-severe-rule hover:bg-severe-soft",
};

const sizes: Record<ButtonSize, string> = {
  patient: "min-h-13 px-5 text-lead",
  dense: "min-h-11 px-4 text-dense",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "patient", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}
