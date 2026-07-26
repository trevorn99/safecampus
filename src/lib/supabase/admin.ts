import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role client — bypasses Row Level Security entirely.
 * Only ever call this from the future Support Console's server-side
 * code, gated by an active support_access_grants row. Never expose
 * this client, or the key it uses, to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
