import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { withBasePath } from '@/lib/base-path';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Guard /api/manager endpoints
  if (pathname.startsWith('/api/manager')) {
    // Exclude auth endpoints (/api/manager/auth/*)
    if (pathname.startsWith('/api/manager/auth')) {
      return NextResponse.next();
    }

    // Allow dev bypass mode for rapid local testing if present
    const devCookie = request.cookies.get('cafe_manager_dev_mode')?.value;
    if (devCookie === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.next();
    }

    // Verify session via Supabase
    let supabaseResponse = NextResponse.next({ request });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        path: '/',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: '/',
            })
          );
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Check bearer token in Authorization header fallback
    let isAuthed = Boolean(!error && user);
    if (!isAuthed) {
      const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const { data: tokenUser } = await supabase.auth.getUser(token);
        if (tokenUser?.user) {
          isAuthed = true;
        }
      }
    }

    if (!isAuthed) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Manager authentication required to access this endpoint.',
        },
        { status: 401 }
      );
    }

    return supabaseResponse;
  }

  // 2. Guard /manager and /kitchen frontend page routes
  if (pathname.startsWith('/manager') || pathname.startsWith('/kitchen')) {
    // Exclude /manager/login and auth endpoints from redirect loop
    if (pathname.startsWith('/manager/login') || pathname.startsWith('/manager/auth')) {
      return NextResponse.next();
    }

    // Allow dev bypass mode for rapid local testing
    const devCookie = request.cookies.get('cafe_manager_dev_mode')?.value;
    if (devCookie === 'true') {
      return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        path: '/',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: '/',
            })
          );
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If no authenticated user, redirect to manager login
    if (error || !user) {
      const loginUrl = new URL(withBasePath('/manager/login'), request.url);
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
      if (forwardedHost) {
        loginUrl.host = forwardedHost;
        loginUrl.protocol = forwardedProto;
      }
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/manager/:path*', '/kitchen/:path*', '/api/manager/:path*'],
};
