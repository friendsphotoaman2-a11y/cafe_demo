import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({
        authenticated: false,
        allowed: false,
        message: 'No active session found.',
      });
    }

    const email = user.email?.toLowerCase().trim();

    // 1. Check is_manager() RPC
    let isAllowed = false;
    try {
      const { data: isMgr } = await supabase.rpc('is_manager');
      if (isMgr === true) {
        isAllowed = true;
      }
    } catch (e) {
      console.error('is_manager RPC error in check route:', e);
    }

    // 2. Check staff_emails & allowed_managers
    if (!isAllowed && email) {
      try {
        const admin = createAdminClient();
        const { data: staffRow } = await admin
          .from('staff_emails')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (staffRow) isAllowed = true;
      } catch {
        // continue
      }

      if (!isAllowed) {
        try {
          const admin = createAdminClient();
          const { data: mgrRow } = await admin
            .from('allowed_managers')
            .select('email')
            .eq('email', email)
            .maybeSingle();

          if (mgrRow) isAllowed = true;
        } catch {
          // continue
        }
      }

      // 3. Check env allowlist
      const envEmails = (process.env.MANAGER_EMAILS || 'friendsphotoaman2@gmail.com')
        .split(',')
        .map(e => e.trim().toLowerCase());
      if (envEmails.includes(email)) {
        isAllowed = true;
      }
    }

    return NextResponse.json({
      authenticated: true,
      allowed: isAllowed,
      email: user.email,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        authenticated: false,
        allowed: false,
        message: err instanceof Error ? err.message : 'Auth verification error',
      },
      { status: 500 }
    );
  }
}
