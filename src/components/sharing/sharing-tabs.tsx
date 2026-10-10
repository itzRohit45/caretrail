import Link from "next/link";
import { cn } from "@/lib/cn";

export function SharingTabs({ active }: { active: "links" | "history" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-pill px-5 font-semibold transition-colors duration-150", on ? "bg-primary text-on-primary" : "text-ink-2 hover:bg-sheet-sunk hover:text-ink")}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Sharing views" className="inline-flex gap-1 rounded-pill border border-rule bg-sheet p-1">
      {tab("/sharing", "Share", active === "links")}
      {tab("/sharing/history", "Access history", active === "history")}
    </nav>
  );
}
