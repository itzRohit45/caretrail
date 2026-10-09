import { todayIST } from "@/lib/format";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function valid(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** ISO date from what was written (ISO, DD/MM/YYYY, DD-MM-YY, 14 Aug 2026). Rejects impossible and future dates. */
export function toIsoDate(raw: string | null | undefined, today = todayIST()): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: number, m: number, d: number;
  let hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else if ((hit = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
    if (y < 100) y += 2000;
  } else if ((hit = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3})[a-z]*[\s,-]+(\d{4})$/i))) {
    [d, m, y] = [Number(hit[1]), MONTHS.indexOf(hit[2].toLowerCase()) + 1, Number(hit[3])];
  } else return null;
  if (!valid(y, m, d) || y < 1950) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return iso > today ? null : iso;
}
