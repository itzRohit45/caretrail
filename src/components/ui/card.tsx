import { cn } from "@/lib/cn";

/** The one surface: white, hairline border. Never nest one inside another. */
export function Card({ className, children, as: Tag = "section" }: { className?: string; children: React.ReactNode; as?: "section" | "article" | "div" | "li" }) {
  return <Tag className={cn("rounded-card border border-rule bg-sheet shadow-card", className)}>{children}</Tag>;
}
