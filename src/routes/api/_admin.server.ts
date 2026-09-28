// Server-only helpers for API route handlers that need the service role key.
// This file has the `.server.ts` suffix so its symbols never ship to the client bundle.
// Route files must `await import("@/routes/api/_admin.server")` inside handler bodies.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let _admin: SupabaseClient<Database> | undefined;

export function getAdmin(): SupabaseClient<Database> | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) return null;
  _admin = createClient<Database>(url, srv, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** SEC-01: verify a Supabase JWT and return the user id, or null. */
export async function verifySupabaseJWT(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length < 20) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

/** DB-backed rate limit via SECURITY DEFINER RPC (service role). */
export async function checkRateDB(userId: string, maxPerMinute = 20): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return true; // fail-open when backend unconfigured
  try {
    const { data, error } = await (admin.rpc as unknown as (
      fn: string, args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>)("check_and_increment_rate", {
      p_user_id: userId,
      p_max_per_minute: maxPerMinute,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

export async function purgeRateLimits(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  try { await (admin.rpc as unknown as (fn: string) => Promise<unknown>)("purge_old_rate_limits"); } catch { /* ignore */ }
}
