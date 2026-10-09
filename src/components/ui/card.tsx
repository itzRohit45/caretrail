import { cn } from "@/lib/cn";

/** A "sheet": the one elevated surface. Never nest one inside another. */
export function Card({ className, children, as: Tag = "section" }: { className?: string; children: React.ReactNode; as?: "section" | "article" | "div" | "li" }) {
  return <Tag className={cn("rounded-card bg-sheet shadow-sheet", className)}>{children}</Tag>;
}
