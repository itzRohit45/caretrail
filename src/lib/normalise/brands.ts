export type BrandRow = { brand: string; generic: string };
export type GenericRow = { generic: string; drug_class: string | null; category: string | null };

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const FORM_PREFIX = /^(tab(let)?s?|cap(sule)?s?|inj(ection)?|syp|syr(up)?|susp(ension)?|t|c)\.?\s+/i;
const STRENGTH = /\b\d+(\.\d+)?\s*(mg|mcg|µg|ug|g|ml|iu|%)?\b/gi;
const RELEASE = /\b(sr|er|xr|cr|mr|od|ds)\b/gi;

/** "Tab. Glycomet-GP 1 mg" -> "Glycomet-GP" (form and strength removed). */
export function cleanBrand(raw: string) {
  return raw.trim().replace(FORM_PREFIX, "").replace(STRENGTH, " ").replace(/\s+/g, " ").trim();
}

export function buildBrandIndex(brands: BrandRow[], generics: GenericRow[]) {
  const index = new Map<string, Set<string>>();
  const add = (k: string, g: string) => {
    if (!k) return;
    if (!index.has(k)) index.set(k, new Set());
    index.get(k)!.add(g);
  };
  for (const b of brands) add(key(b.brand), b.generic);
  for (const g of generics) add(key(g.generic), g.generic);
  return index;
}

export type BrandMatch = { generics: string[]; recognised: boolean };

/**
 * Maps a brand or generic name, as written on a prescription, to normalised generics.
 * Tries the full cleaned name, then without release suffixes (SR, XR...), then the first word.
 * Combinations written as "A + B" are matched part by part.
 */
export function matchBrand(raw: string, index: Map<string, Set<string>>): BrandMatch {
  const cleaned = cleanBrand(raw);
  const parts = cleaned.split(/\s*[+/]\s*|\s+and\s+/i).filter(Boolean);
  if (parts.length > 1) {
    const all = parts.map((p) => matchBrand(p, index));
    if (all.every((m) => m.recognised)) return { generics: [...new Set(all.flatMap((m) => m.generics))].sort(), recognised: true };
  }
  const candidates = [key(cleaned), key(cleaned.replace(RELEASE, " ")), key(cleaned.split(/[\s-]/)[0] ?? "")];
  for (const c of candidates) {
    const hit = index.get(c);
    if (hit) return { generics: [...hit].sort(), recognised: true };
  }
  return { generics: [], recognised: false };
}

export function categoriesFor(generics: string[], rows: GenericRow[]) {
  const byName = new Map(rows.map((r) => [r.generic, r]));
  return [...new Set(generics.map((g) => byName.get(g)?.category).filter((c): c is string => Boolean(c)))];
}
