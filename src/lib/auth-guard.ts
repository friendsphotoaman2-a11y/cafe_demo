import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ManagerAuthResult {
  allowed: boolean;
  email?: string;
  response?: NextResponse;
}

/**
 * Server-side security guard for all manager API endpoints.
 * Validates the user's Supabase authentication cookie, checks if their email
 * is in the MANAGER_EMAILS environment allowlist or allowed_managers / staff_emails database tables,
 * or verifies the is_manager() RPC.
 *
 * Returns { allowed: true, email } on success, or { allowed: false, response: 401/403 } on failure.
 */
export async function verifyManagerAuth(req?: NextRequest): Promise<ManagerAuthResult> {
  try {
    // In local non-production development, allow dev cookie bypass
    if (req?.cookies?.get('cafe_manager_dev_mode')?.value === 'true' && process.env.NODE_ENV !== 'production') {
      return { allowed: true, email: 'developer@local.dev' };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    // Check Authorization header for Bearer token fallback if cookie not present
    let authUser = user;
    if ((userErr || !authUser) && req) {
      const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const { data: tokenUser } = await supabase.auth.getUser(token);
        if (tokenUser?.user) {
          authUser = tokenUser.user;
        }
      }
    }

    if (!authUser || !authUser.email) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in as a manager.',
          },
          { status: 401 }
        ),
      };
    }

    const email = authUser.email.toLowerCase().trim();

    // 1. Check MANAGER_EMAILS environment variable allowlist
    const envEmails = (process.env.MANAGER_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (envEmails.includes(email)) {
      return { allowed: true, email };
    }

    // 2. Check is_manager() RPC
    try {
      const { data: isMgr } = await supabase.rpc('is_manager');
      if (isMgr === true) {
        return { allowed: true, email };
      }
    } catch {
      // Continue to DB checks
    }

    // 3. Check allowed_managers and staff_emails database tables via admin client
    try {
      const admin = createAdminClient();
      const { data: allowedRow } = await admin
        .from('allowed_managers')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (allowedRow) {
        return { allowed: true, email };
      }

      const { data: staffRow } = await admin
        .from('staff_emails')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (staffRow) {
        return { allowed: true, email };
      }
    } catch {
      // Ignore DB table errors
    }

    // Account is authenticated but not authorized as manager
    return {
      allowed: false,
      email,
      response: NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied: Your account is not authorized as a cafe manager.',
        },
        { status: 403 }
      ),
    };
  } catch (err) {
    console.error('Manager auth verification error:', err);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'AUTH_ERROR',
          message: 'Error verifying manager authorization.',
        },
        { status: 500 }
      ),
    };
  }
}
