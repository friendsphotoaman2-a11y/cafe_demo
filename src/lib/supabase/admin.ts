import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-only Admin Client with service_role key
// CRITICAL: NEVER import or expose this file in client-side code!
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
