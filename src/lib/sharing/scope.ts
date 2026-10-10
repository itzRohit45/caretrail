import { LAB_CATEGORY } from "@/lib/normalise/labs";
import { CONDITION_LABELS } from "@/lib/normalise/conditions";

// What a share link may show. Applied on the server to every row before it leaves the database layer.

export type Scope = { type: "all" | "conditions" | "months"; conditions: string[]; months: number | null };

export const scopeFromLink = (l: { scope_type: string; scope_conditions: string[]; scope_months: number | null }): Scope => ({
  type: l.scope_type as Scope["type"],
  conditions: l.scope_conditions,
  months: l.scope_months,
});

export function scopeStart(scope: Scope, today: string) {
  if (scope.type !== "months" || !scope.months) return null;
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - scope.months, d)).toISOString().slice(0, 10);
}

export function documentInScope(doc: { condition_tags: string[]; date: string }, scope: Scope, today: string) {
  if (scope.type === "all") return true;
  if (scope.type === "conditions") return doc.condition_tags.some((t) => scope.conditions.includes(t));
  return doc.date >= (scopeStart(scope, today) ?? "0000-01-01");
}

/** Facts carry their own category, so a diabetes link never shows an asthma inhaler from a mixed document. */
export function factInScope(fact: { categories: string[]; date: string | null }, scope: Scope, today: string) {
  if (scope.type === "all") return true;
  if (scope.type === "conditions") return fact.categories.some((c) => scope.conditions.includes(c));
  return (fact.date ?? "") >= (scopeStart(scope, today) ?? "0000-01-01");
}

export const labCategories = (code: string | null) => (code && LAB_CATEGORY[code] ? [LAB_CATEGORY[code]] : []);

export function describeScope(scope: Scope) {
  if (scope.type === "all") return "All records";
  if (scope.type === "months") return `Last ${scope.months} months`;
  return `${scope.conditions.map((c) => CONDITION_LABELS[c] ?? c).join(", ")} only`;
}
