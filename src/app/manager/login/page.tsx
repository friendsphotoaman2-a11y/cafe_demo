'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl, withBasePath, getCookiePath } from '@/lib/base-path';

function ManagerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check if redirected with not_allowed or auth_failed
    const errorParam = searchParams.get('error');
    if (errorParam === 'not_allowed') {
      setErrorMsg('Access Denied: Yeh Google account cafe manager ke roop mein authorized nahi hai. Sirf registered manager email ko access milega.');
    } else if (errorParam === 'auth_failed') {
      setErrorMsg('Authentication failed. Kripya dobara prayas karein.');
    }

    const targetUrl = searchParams.get('redirect') || searchParams.get('next') || '/manager';

    // Check if an unauthorized user is currently cached in the browser session
    async function checkCurrentSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Verify manager authorization
        try {
          const res = await fetch(apiUrl('/api/manager/auth/check'));
          const data = await res.json();
          if (data.allowed) {
            router.replace(targetUrl);
          } else {
            await supabase.auth.signOut();
            setErrorMsg('Access Denied: Yeh Google account cafe manager ke roop mein authorized nahi hai.');
          }
        } catch {
          // Ignore network glitch
        }
      }
    }

    checkCurrentSession();
  }, [searchParams, router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const targetUrl = searchParams.get('redirect') || searchParams.get('next') || '/manager';
      // Save next target in cookie so redirectUri remains clean without query params (easier matching in Supabase)
      document.cookie = `auth_redirect_next=${encodeURIComponent(targetUrl)}; path=/; max-age=600`;
      
      const redirectUri = new URL(withBasePath('/auth/callback'), origin);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri.toString(),
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch {
      setErrorMsg('Google login failed. Please verify connection.');
      setLoading(false);
    }
  }

  // Quick dev test login helper for local demonstration and emergency access
  function handleDevBypass() {
    const targetUrl = searchParams.get('redirect') || searchParams.get('next') || '/manager';
    document.cookie = `cafe_manager_dev_mode=true; path=/; max-age=86400`;
    sessionStorage.setItem('cafe_manager_dev_mode', 'true');
    window.location.href = withBasePath(targetUrl);
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-stone-950 via-stone-900 to-amber-950 flex flex-col justify-center items-center p-4 text-white">
      <div className="w-full max-w-md bg-stone-900/90 border border-amber-900/40 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20 text-stone-950 font-bold text-2xl">
          <ShieldCheck className="w-8 h-8 text-stone-950" />
        </div>

        <h1 className="text-2xl font-black text-center text-white tracking-tight">
          Manager Portal
        </h1>
        <p className="text-xs text-amber-200/70 text-center mt-1 mb-8">
          Authorized Cafe Management &amp; Realtime Dashboard
        </p>

        {errorMsg && (
          <div
            id="auth-error-alert"
            className="p-3.5 mb-6 bg-red-950/90 border border-red-700/80 rounded-2xl text-xs text-red-200 flex items-center gap-2.5 shadow-lg animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-sm shadow-md transition flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer active:scale-95 touch-manipulation select-none"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-stone-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-stone-800"></div>
            <span className="shrink mx-4 text-[10px] text-stone-500 uppercase tracking-widest font-mono">
              Staff Verification
            </span>
            <div className="grow border-t border-stone-800"></div>
          </div>

          {/* Dev mode fast-track */}
          <button
            onClick={handleDevBypass}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-amber-900/50 bg-stone-800/80 hover:bg-stone-800 active:scale-95 text-amber-300 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
          >
            <span>Enter Dashboard (Development Bypass)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-800/60 text-center space-y-1">
          <p className="text-[11px] text-stone-400">
            Access is restricted to emails registered in staff allowlist.
          </p>
          <p className="text-[10px] text-stone-500 font-mono">
            Requires active manager permissions.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ManagerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-950 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <ManagerLoginForm />
    </Suspense>
  );
}
