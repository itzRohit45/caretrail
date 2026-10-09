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

function slots(pattern: string) {
  const parts = pattern.split(/\s*[-–]\s*/);
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
  const pattern = raw.match(/\b([0-9½](?:\s*[-–]\s*[0-9½]){2,3})\b/);
  let base = pattern ? slots(pattern[1]) : null;
  if (!base) base = TOKENS.find(([re]) => re.test(raw))?.[1] ?? null;
  const food = FOOD.find(([re]) => re.test(raw))?.[1];
  if (!base) return food ? `Take ${food}` : null;
  return food ? `${base}, ${food}` : base;
}
