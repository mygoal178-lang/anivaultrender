import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** True when the minimum publishable Supabase credentials are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  console.error(
    '[AniVault] Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY. API database routes will be degraded until env vars are set.'
  );
}

const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.local';
const effectiveKey = supabasePublishableKey || 'placeholder-publishable-key';

/** Shared options: no browser session; WebSocket polyfill for Node (Render). */
const baseOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    // Node < 22 has no global WebSocket — use `ws` package
    transport: ws as unknown as typeof WebSocket,
  },
};

export const supabase: SupabaseClient = createClient(effectiveUrl, effectiveKey, baseOptions);

export const supabaseAdmin: SupabaseClient | null =
  supabaseServiceRoleKey && isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseServiceRoleKey, baseOptions)
    : null;

export function createAuthenticatedSupabaseClient(token?: string): SupabaseClient {
  if (!token || !isSupabaseConfigured) return supabase;

  return createClient(effectiveUrl, effectiveKey, {
    ...baseOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
