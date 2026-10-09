import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/env";

let admin: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client. Bypasses RLS, so it is used only after the server has checked a
 * share/emergency token or for server-owned tables (cache, rate limits, audit log).
 */
export function adminClient() {
  if (!admin) {
    const env = serverEnv();
    admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
