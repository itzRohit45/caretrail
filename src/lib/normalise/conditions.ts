const RULES: [string, RegExp][] = [
  ["diabetes", /diabet|\bt2dm\b|\bt1dm\b|\bdm\b|\bdm2\b|hyperglyc|hypoglyc/i],
  ["hypertension", /hypertens|\bhtn\b|high blood pressure/i],
  ["thyroid", /thyroid|hypothyr|hyperthyr|goit|hashimoto/i],
  ["asthma", /asthma|copd|bronch|wheez/i],
  ["cardiac", /coronary|\bcad\b|myocard|\bn?stemi\b|angina|heart|cardiac|\bihd\b|dyslipid|hyperlipid|cholesterol|\bpci\b/i],
];

export const CONDITION_LABELS: Record<string, string> = {
  diabetes: "Diabetes",
  hypertension: "Blood pressure",
  thyroid: "Thyroid",
  asthma: "Asthma",
  cardiac: "Heart",
  other: "Other",
};

export function conditionCategory(name: string) {
  return RULES.find(([, re]) => re.test(name))?.[0] ?? "other";
}
