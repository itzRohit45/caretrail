export const DEMO_PATIENTS = {
  ravi: { name: "Ravi Kumar", line: "55, diabetes and blood pressure, 4 doctors", shows: "Medicine mix-ups, an allergy clash, HbA1c trend and Test Saver" },
  lakshmi: { name: "Lakshmi Iyer", line: "42, thyroid and asthma", shows: "Sharing only thyroid records, with asthma hidden" },
  arun: { name: "Arun Prakash", line: "68, after a heart attack", shows: "Emergency card and a major drug interaction" },
} as const;
export type DemoKey = keyof typeof DEMO_PATIENTS;
