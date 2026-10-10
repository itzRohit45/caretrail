import { describe, expect, it } from "vitest";
import { documentInScope, factInScope, describeScope, type Scope } from "../scope";
import { hashToken, isTokenShape, newOtp, newToken } from "../tokens";

const today = "2026-10-10";
const thyroidOnly: Scope = { type: "conditions", conditions: ["thyroid"], months: null };
const sixMonths: Scope = { type: "months", conditions: [], months: 6 };

describe("scope", () => {
  it("condition scope hides other conditions, even inside the same patient", () => {
    expect(documentInScope({ condition_tags: ["thyroid"], date: "2026-08-22" }, thyroidOnly, today)).toBe(true);
    expect(documentInScope({ condition_tags: ["asthma"], date: "2026-04-10" }, thyroidOnly, today)).toBe(false);
    expect(documentInScope({ condition_tags: [], date: "2026-04-10" }, thyroidOnly, today)).toBe(false);
    expect(factInScope({ categories: ["asthma"], date: "2026-04-10" }, thyroidOnly, today)).toBe(false);
  });
  it("month scope keeps only recent items", () => {
    expect(documentInScope({ condition_tags: [], date: "2026-04-11" }, sixMonths, today)).toBe(true);
    expect(documentInScope({ condition_tags: [], date: "2026-04-09" }, sixMonths, today)).toBe(false);
    expect(factInScope({ categories: [], date: null }, sixMonths, today)).toBe(false);
  });
  it("describes scope in plain words", () => {
    expect(describeScope(thyroidOnly)).toBe("Thyroid only");
    expect(describeScope(sixMonths)).toBe("Last 6 months");
  });
});

describe("tokens", () => {
  it("are 32 random bytes in base64url and hash to 64 hex chars", () => {
    const t = newToken();
    expect(isTokenShape(t)).toBe(true);
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(hashToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(newToken()).not.toBe(t);
  });
  it("rejects malformed tokens before any lookup", () => {
    expect(isTokenShape("abc")).toBe(false);
    expect(isTokenShape(null)).toBe(false);
  });
  it("makes six-digit codes", () => expect(newOtp()).toMatch(/^\d{6}$/));
});
