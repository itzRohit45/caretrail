// Lab name, unit and range normalisation. Original value and unit are always kept.

const ALIASES: Record<string, string[]> = {
  HBA1C: ["hba1c", "a1c", "glycatedhaemoglobin", "glycatedhemoglobin", "glycosylatedhaemoglobin", "glycosylatedhemoglobin", "glycosylatedhb", "glycatedhb", "haemoglobina1c", "hemoglobina1c"],
  FBS: ["fbs", "fastingbloodsugar", "fastingbloodglucose", "fastingplasmaglucose", "fastingglucose", "glucosefasting", "bloodsugarfasting", "plasmaglucosefasting", "fpg"],
  PPBS: ["ppbs", "postprandialbloodsugar", "postprandialglucose", "postprandialbloodglucose", "glucosepostprandial", "bloodsugarpp", "glucosepp", "ppbg", "plasmaglucosepp"],
  TSH: ["tsh", "thyroidstimulatinghormone", "ultrasensitivetsh", "ustsh", "tsh3rdgeneration", "tshultrasensitive"],
  FT4: ["ft4", "freet4", "freethyroxine", "freethyroxineft4"],
  LDL: ["ldl", "ldlcholesterol", "ldlc", "lowdensitylipoprotein", "ldlcholesteroldirect", "ldlcholesterolcalculated"],
  HDL: ["hdl", "hdlcholesterol", "hdlc", "highdensitylipoprotein"],
  TC: ["totalcholesterol", "cholesteroltotal", "serumcholesterol", "cholesterol"],
  TG: ["triglycerides", "triglyceride", "tg", "serumtriglycerides"],
  CREAT: ["creatinine", "serumcreatinine", "screatinine"],
  UREA: ["urea", "bloodurea", "serumurea"],
  EGFR: ["egfr", "estimatedgfr"],
  HB: ["haemoglobin", "hemoglobin", "hb", "hgb"],
  TROPONIN: ["troponini", "troponint", "hstroponini", "hstroponint", "troponin", "hstroponin"],
  BP: ["bloodpressure", "bp"],
};
const BY_ALIAS = new Map(Object.entries(ALIASES).flatMap(([code, names]) => names.map((n) => [n, code] as const)));

export const LAB_CATEGORY: Record<string, string> = {
  HBA1C: "diabetes", FBS: "diabetes", PPBS: "diabetes",
  TSH: "thyroid", FT4: "thyroid",
  LDL: "cardiac", HDL: "cardiac", TC: "cardiac", TG: "cardiac", TROPONIN: "cardiac",
  BP_SYS: "hypertension", BP_DIA: "hypertension",
  CREAT: "other", UREA: "other", EGFR: "other", HB: "other",
};

export function testCode(name: string): string | null {
  return BY_ALIAS.get(name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "")) ?? null;
}

const unitKey = (u: string) => u.toLowerCase().replace(/\s+/g, "").replace(/[µμ]/g, "u");

type Conversion = { to: string; from: Record<string, (v: number) => number> };
const CONVERSIONS: Record<string, Conversion> = {
  HBA1C: { to: "%", from: { "%": (v) => v, "mmol/mol": (v) => v / 10.929 + 2.15 } },
  FBS: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 18 } },
  PPBS: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 18 } },
  LDL: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 38.67 } },
  HDL: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 38.67 } },
  TC: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 38.67 } },
  TG: { to: "mg/dL", from: { "mg/dl": (v) => v, "mmol/l": (v) => v * 88.57 } },
  CREAT: { to: "mg/dL", from: { "mg/dl": (v) => v, "umol/l": (v) => v / 88.4 } },
  TSH: { to: "mIU/L", from: { "miu/l": (v) => v, "uiu/ml": (v) => v } },
  FT4: { to: "ng/dL", from: { "ng/dl": (v) => v, "pmol/l": (v) => v / 12.87 } },
  BP_SYS: { to: "mmHg", from: { mmhg: (v) => v } },
  BP_DIA: { to: "mmHg", from: { mmhg: (v) => v } },
};

const round = (v: number) => Math.round(v * 100) / 100;

/** Value in the unit we chart in, or null when the unit is unknown (never guessed). */
export function normaliseValue(code: string | null, value: number | null, unit: string | null) {
  if (code === null || value === null) return { value: null, unit: null };
  const conv = CONVERSIONS[code];
  if (!conv) return { value: null, unit: null };
  const fn = conv.from[unitKey(unit ?? conv.to)];
  return fn ? { value: round(fn(value)), unit: conv.to } : { value: null, unit: null };
}

export function parseNumber(text: string | number | null | undefined): number | null {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (!text) return null;
  // A trailing printed flag (H, L, High, Low, *, arrows) is not part of the value.
  const m = text.replace(/,/g, "").match(/^\s*(-?\d+(\.\d+)?)\s*(h|l|high|low|\*+|↑|↓)?\s*$/i);
  return m ? Number(m[1]) : null;
}

/** "4.0 - 5.6", "70-99 mg/dL", "< 200", "> 40", "Up to 5.7" */
export function parseRange(text: string | null | undefined): { low: number | null; high: number | null } {
  if (!text) return { low: null, high: null };
  const t = text.replace(/,/g, "");
  const between = t.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
  if (between) return { low: Number(between[1]), high: Number(between[2]) };
  const upper = t.match(/(?:<|≤|upto|up to|below|less than)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (upper) return { low: null, high: Number(upper[1]) };
  const lower = t.match(/(?:>|≥|above|more than|greater than)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (lower) return { low: Number(lower[1]), high: null };
  return { low: null, high: null };
}

/** "142/90" written for blood pressure becomes two results. */
export function splitBloodPressure(text: string): { systolic: number; diastolic: number } | null {
  const m = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  return m ? { systolic: Number(m[1]), diastolic: Number(m[2]) } : null;
}
