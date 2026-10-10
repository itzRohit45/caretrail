/** "Dr. A. Suresh" and "dr a suresh" are the same doctor; "TNMC 61234" and "tnmc-61234" the same number. */
export const sameDoctorName = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/^\s*dr\b\.?/, "").replace(/[^a-z0-9]/g, "");
  return n(a) === n(b);
};
export const sameRegNo = (a: string, b: string) => a.toUpperCase().replace(/[^A-Z0-9]/g, "") === b.toUpperCase().replace(/[^A-Z0-9]/g, "");
