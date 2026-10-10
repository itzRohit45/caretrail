// Decodes Indian prescription shorthand into plain English. The raw text is always stored too.

const TOKENS: [RegExp, string][] = [
  [/\b(od|qd)\b/i, "Once daily"],
  [/\b(bd|bid)\b/i, "Twice daily"],
  [/\b(tds|tid)\b/i, "Three times daily"],
  [/\b(qid|qds)\b/i, "Four times daily"],
  [/\bhs\b/i, "At bedtime"],
  [/\b(sos|prn)\b/i, "Only when needed"],
  [/\bstat\b/i, "Immediately, once"],
];
const FOOD: [RegExp, string][] = [
  [/\b(ac|before food|before meals?|empty stomach)\b/i, "before food"],
  [/\b(pc|after food|after meals?)\b/i, "after food"],
];

const SLOTS = ["morning", "afternoon", "night"];

/** "1-0-1", "1 0 1", "101", "o-o-1" -> ["1","0","1"]; anything else -> null. */
function slotParts(raw: string): string[] | null {
  const t = raw.toLowerCase().replace(/(?<=^|[\s\-–])o(?=$|[\s\-–])/g, "0");
  const spaced = t.match(/(?:^|[^0-9½.])([0-9½](?:\s*[-–]\s*[0-9½]|\s+[0-9½]){2,3})(?![0-9.])/);
  if (spaced) return spaced[1].split(/\s*[-–]\s*|\s+/);
  const packed = t.match(/(?:^|[^0-9.])([0-2½]{3,4})(?![0-9.])(?!\s*(?:mg|mcg|ml|g|iu|units?)\b)/);
  return packed ? [...packed[1]] : null;
}

function slots(parts: string[]) {
  const names = parts.length === 4 ? ["morning", "afternoon", "evening", "night"] : SLOTS;
  const taken = parts
    .map((p, i) => ({ n: p === "½" ? 0.5 : Number(p), slot: names[i] }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0);
  if (taken.length === 0) return null;
  const phrase = taken.map((t) => (t.n === 1 ? t.slot : `${t.n === 0.5 ? "half" : t.n} in the ${t.slot}`));
  const text = phrase.length === 1 ? phrase[0] : `${phrase.slice(0, -1).join(", ")} and ${phrase.at(-1)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function decodeFrequency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = slotParts(raw);
  let base = parts ? slots(parts) : null;
  if (!base) base = TOKENS.find(([re]) => re.test(raw))?.[1] ?? null;
  const food = FOOD.find(([re]) => re.test(raw))?.[1];
  if (!base) return food ? `Take ${food}` : null;
  return food ? `${base}, ${food}` : base;
}

const PER_DAY: [RegExp, number][] = [
  [/\b(od|qd|hs)\b/i, 1],
  [/\b(bd|bid)\b/i, 2],
  [/\b(tds|tid)\b/i, 3],
  [/\b(qid|qds)\b/i, 4],
];

/** Doses a day from the written pattern; null when it cannot be told (SOS, "as directed"). */
export function dosesPerDay(raw: string | null | undefined): number | null {
  if (!raw || /\b(sos|prn|stat)\b/i.test(raw)) return null;
  const parts = slotParts(raw);
  if (parts) {
    const total = parts.reduce((sum, p) => sum + (p === "½" ? 0.5 : Number(p) || 0), 0);
    return total > 0 ? total : null;
  }
  return PER_DAY.find(([re]) => re.test(raw))?.[1] ?? null;
}

const NOT_COUNTED = /\b(syrup|syp|bottle|susp|suspension|drops?|cream|ointment|gel|lotion|inhaler|puffs?|spray|ml)\b/i;

/**
 * "= (20)" tablets at "1-0-1" is 10 days. Only for counted units (not "1 bottle" of syrup) and only
 * when the quantity divides into whole days. `text` is the medicine line as written.
 */
export function daysFromQuantity(quantity: number | null | undefined, frequency: string | null | undefined, text = ""): number | null {
  const perDay = dosesPerDay(frequency);
  if (!quantity || !perDay || NOT_COUNTED.test(text)) return null;
  const days = quantity / perDay;
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : null;
}

/**
 * The model sometimes copies a medicine line verbatim ("T. AZILIFT 500mg 001 = 5") but leaves the
 * frequency and quantity fields empty. Both are then read from that written line, deterministically.
 */
export function readDosing(m: { brand_name: string; frequency?: string | null; quantity?: number | null; duration_days?: number | null; source_text: string }) {
  const line = m.source_text.replace(m.brand_name, " ");
  const parts = m.frequency ? null : slotParts(line);
  const frequency = m.frequency || (parts ? parts.join("-") : TOKENS.some(([re]) => re.test(line)) ? line.match(/\b(od|qd|bd|bid|tds|tid|qid|qds|hs|sos|prn)\b/i)?.[1]?.toUpperCase() ?? null : null);
  const quantity = m.quantity ?? (Number(line.match(/=\s*\(?\s*(\d{1,3})\s*\)?/)?.[1]) || null);
  const fromQuantity = m.duration_days ? null : daysFromQuantity(quantity, frequency, `${m.brand_name} ${m.source_text}`);
  return { frequency, quantity, duration_days: m.duration_days ?? fromQuantity, daysFromQuantity: fromQuantity !== null };
}
