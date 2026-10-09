import { cn } from "@/lib/cn";

/** Large radio tiles: easier than a dropdown for a 55-year-old on a phone. Native radios underneath. */
export function ChoiceTiles({
  name,
  legend,
  options,
  defaultValue,
  columns = "grid-cols-2 sm:grid-cols-4",
  error,
  hint,
}: {
  name: string;
  legend: string;
  options: { value: string; label: React.ReactNode; srLabel?: string }[];
  defaultValue?: string | null;
  columns?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold text-ink">{legend}</legend>
      {hint ? <p className="text-dense text-ink-2">{hint}</p> : null}
      <div className={cn("grid gap-2", columns)}>
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-13 cursor-pointer items-center justify-center rounded-control border border-rule-strong bg-sheet px-3 text-center font-semibold text-ink transition-colors duration-150 hover:border-ink-3 has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
          >
            <input type="radio" name={name} value={o.value} defaultChecked={(defaultValue ?? "") === o.value} className="sr-only" />
            {o.label}
            {o.srLabel ? <span className="sr-only">{o.srLabel}</span> : null}
          </label>
        ))}
      </div>
      {error ? <p className="font-semibold text-severe">{error}</p> : null}
    </fieldset>
  );
}
