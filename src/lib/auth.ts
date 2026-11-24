import { createClient } from '@/lib/supabase/server';

/**
 * Checks if the currently logged-in user has Manager rights
 * by comparing against the MANAGER_EMAILS env variable or allowed_managers table.
 */
export async function verifyManagerAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { isAuthorized: false, user: null };
  }

  const allowedEmails = (process.env.MANAGER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = user.email.toLowerCase();

  // 1. Check environment variable allowlist
  if (allowedEmails.includes(userEmail)) {
    return { isAuthorized: true, user };
  }

  // 2. Also check database allowed_managers table
  const { data: managerRecord } = await supabase
    .from('allowed_managers')
    .select('id')
    .ilike('email', userEmail)
    .maybeSingle();

  if (managerRecord) {
    return { isAuthorized: true, user };
  }

  return { isAuthorized: false, user };
}
