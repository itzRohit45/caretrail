import { describe, expect, it } from "vitest";
import { sameDoctorName, sameRegNo } from "./identity";

describe("same doctor across visits", () => {
  it("ignores the Dr prefix, dots, case and spacing", () => {
    expect(sameDoctorName("Dr. A. Suresh", "dr a suresh")).toBe(true);
    expect(sameDoctorName("A Suresh", "Dr.A.Suresh")).toBe(true);
  });
  it("does not strip names that merely start with dr", () => {
    expect(sameDoctorName("Drake Mehta", "ake Mehta")).toBe(false);
  });
  it("tells different doctors apart", () => {
    expect(sameDoctorName("Dr. A. Suresh", "Dr. K. Ramesh")).toBe(false);
  });
  it("matches registration numbers regardless of spacing, dashes and case", () => {
    expect(sameRegNo("TNMC 61234", "tnmc-61234")).toBe(true);
    expect(sameRegNo("TNMC 61234", "TNMC 61235")).toBe(false);
  });
});
