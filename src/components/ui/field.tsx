import { WarningCircle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";

export const inputClass =
  "block w-full min-h-13 rounded-control border border-rule-strong bg-sheet px-4 text-body text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 focus-visible:border-primary aria-[invalid=true]:border-severe";

/** Label above, helper under the label, error below. Never placeholder-as-label. */
export function Field({
  id,
  label,
  helper,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-3"> (optional)</span> : null}
      </label>
      {helper ? (
        <p id={`${id}-help`} className="text-dense text-ink-2">
          {helper}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-dense font-semibold text-severe">
          <WarningCircle aria-hidden weight="fill" className="size-5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, helper?: string, error?: string) {
  return cn(helper && `${id}-help`, error && `${id}-error`) || undefined;
}
