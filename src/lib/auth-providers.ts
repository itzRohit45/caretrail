import "server-only";

/**
 * Is Google sign-in switched on in Supabase Auth? Read from the project's public auth settings, so the
 * button appears only once the provider is configured (never a button that cannot work).
 */
export async function googleEnabled() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return body.external?.google === true;
  } catch {
    return false;
  }
}
