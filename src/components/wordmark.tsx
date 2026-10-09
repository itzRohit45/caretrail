/** Text wordmark: a dated sheet glyph (from the icon set) and the name. */
import { CalendarDot } from "@phosphor-icons/react/ssr";

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-title font-bold text-ink">
      <CalendarDot aria-hidden weight="fill" className="size-7 text-primary" />
      CareTrail
    </span>
  );
}
