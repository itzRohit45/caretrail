const IST = "Asia/Kolkata";

/** Dates are stored as ISO dates (YYYY-MM-DD) or UTC timestamps and shown in IST. */
function toDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST }).format(
    toDate(value),
  );
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  }).format(toDate(value));
}

export function dateParts(value: string) {
  const d = toDate(value);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...o, timeZone: IST }).format(d);
  return { day: part({ day: "numeric" }), month: part({ month: "short" }), year: part({ year: "numeric" }) };
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

export function ageFrom(dob: string | null) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = todayIST().split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / 86_400_000);
}

/** "Gluconorm 500" + "500" reads as "Gluconorm 500", not "Gluconorm 500 500". */
export function medicineLabel(brand: string, dose: string | null) {
  const strength = dose?.trim().match(/^([\d.]+)\s*(mg|mcg|g|ml|iu)?$/i)?.[1];
  if (!dose || (strength && brand.split(/\s+/).includes(strength))) return brand;
  return `${brand} ${dose}`;
}
