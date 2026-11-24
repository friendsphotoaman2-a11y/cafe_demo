import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withBasePath } from '@/lib/base-path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const cookieStore = await cookies();
  const cookieNext = cookieStore.get('auth_redirect_next')?.value;
  const next = searchParams.get('next') || cookieNext || '/manager';

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const email = session.user.email?.toLowerCase().trim();

      // 1. Check is_manager() RPC
      let isAllowed = false;
      try {
        const { data: isMgr } = await supabase.rpc('is_manager');
        if (isMgr === true) {
          isAllowed = true;
        }
      } catch (err) {
        console.error('Error invoking is_manager():', err);
      }

      // 2. Fallback check against staff_emails / allowed_managers table
      if (!isAllowed && email) {
        try {
          const admin = createAdminClient();
          // Check staff_emails
          const { data: staffRow } = await admin
            .from('staff_emails')
            .select('email')
            .eq('email', email)
            .maybeSingle();

          if (staffRow) {
            isAllowed = true;
          }
        } catch {
          // Table might be named allowed_managers
        }

        if (!isAllowed) {
          try {
            const admin = createAdminClient();
            const { data: mgrRow } = await admin
              .from('allowed_managers')
              .select('email')
              .eq('email', email)
              .maybeSingle();

            if (mgrRow) {
              isAllowed = true;
            }
          } catch {
            // ignore
          }
        }

        // 3. Environment allowlist check
        const envEmails = (process.env.MANAGER_EMAILS || 'friendsphotoaman2@gmail.com')
          .split(',')
          .map(e => e.trim().toLowerCase());
        if (envEmails.includes(email)) {
          isAllowed = true;
        }
      }

      // If user does not have manager authorization
      if (!isAllowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL(withBasePath('/manager/login?error=not_allowed'), request.url));
      }

      const redirectPath = next.startsWith('/') ? next : `/${next}`;
      return NextResponse.redirect(new URL(withBasePath(redirectPath), request.url));
    }
  }

  return NextResponse.redirect(new URL(withBasePath('/manager/login?error=auth_failed'), request.url));
}
