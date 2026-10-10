import "server-only";
import { serverEnv } from "@/lib/env";

/** Transactional email through Brevo. Returns false (never throws) when unconfigured or refused. */
export async function sendEmail(to: string, subject: string, text: string) {
  const env = serverEnv();
  if (!env.BREVO_API_KEY || !env.ALERT_FROM_EMAIL) return false;
  // Demo accounts use the reserved example.com domain, which can never receive mail.
  if (/@example\.(com|org|net)$/i.test(to)) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
        // Brevo's firewall rejects requests without a recognisable user agent.
        "user-agent": "CareTrail/1.0",
      },
      body: JSON.stringify({ sender: { name: "CareTrail", email: env.ALERT_FROM_EMAIL }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
