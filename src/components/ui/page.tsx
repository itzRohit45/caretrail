import { cn } from "@/lib/cn";

/** Page title in the serif display face, with an optional line above and an action on the right. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  aside,
  width = "app",
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  width?: "app" | "wide";
}) {
  return (
    <div className={cn("mx-auto flex flex-col gap-5 px-4 pt-8 pb-6 sm:px-6 md:flex-row md:items-end md:justify-between md:pt-12 md:pb-8", width === "app" ? "max-w-4xl" : "max-w-6xl")}>
      <div className="min-w-0 space-y-3">
        {kicker ? <p className="text-dense font-semibold text-ink-2">{kicker}</p> : null}
        <h1 className="font-serif text-display font-medium md:text-headline">{title}</h1>
        {subtitle ? <p className="max-w-[54ch] text-lead text-ink-2">{subtitle}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function PageBody({ children, width = "app" }: { children: React.ReactNode; width?: "app" | "wide" }) {
  return <div className={cn("mx-auto space-y-6 px-4 pb-12 sm:px-6", width === "app" ? "max-w-4xl" : "max-w-6xl")}>{children}</div>;
}

/** A titled white section. */
export function SheetSection({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("rounded-card border border-rule bg-sheet p-5 shadow-card sm:p-7", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-title font-bold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-ink-2">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
