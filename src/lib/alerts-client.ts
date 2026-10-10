// Dismissed alerts are remembered on this device in a small cookie (ids only, no medical content),
// so Home can leave them out when it is rendered on the server.
const NAME = "ct-dismissed";

export function dismissedIds() {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${NAME}=`))?.slice(NAME.length + 1);
  return new Set(decodeURIComponent(raw ?? "").split(",").filter(Boolean));
}

export function dismissAlerts(ids: string[]) {
  const next = [...new Set([...dismissedIds(), ...ids])].slice(-60);
  document.cookie = `${NAME}=${encodeURIComponent(next.join(","))}; path=/; max-age=${60 * 60 * 24 * 60}; samesite=lax`;
  window.dispatchEvent(new Event("ct-alerts-changed"));
}

export const openAlerts = () => window.dispatchEvent(new Event("ct-open-alerts"));
