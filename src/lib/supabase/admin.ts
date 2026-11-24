import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only Admin Client with service_role key
// Reuses the client instance across requests to maintain persistent HTTP connection pooling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAdminClient: SupabaseClient<any, 'public', any> | null = null;

export function createAdminClient() {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cachedAdminClient = createSupabaseClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}
