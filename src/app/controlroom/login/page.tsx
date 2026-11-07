"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, StaffRole } from "@/lib/auth-context";
import {
  Lock,
  Coffee,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  LogOut,
  Sparkles,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/controlroom";

  const { user, loginWithGoogle, loginWithStaffRole, logout } = useAuth();
  const [selectedRole, setSelectedRole] = useState<StaffRole>("owner");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const roles: { id: StaffRole; title: string; desc: string; defaultPin: string }[] = [
    { id: "owner", title: "Café Owner", desc: "Full access to settings, menu, tables, revenue & redemptions", defaultPin: "1234" },
    { id: "manager", title: "Store Manager", desc: "Manage menu, tables, orders, kitchen & cashier", defaultPin: "2345" },
    { id: "cashier", title: "Head Cashier", desc: "Counter settlements, billing & receipts", defaultPin: "3456" },
    { id: "kitchen", title: "Kitchen Chef", desc: "KDS order queue and cooking states only", defaultPin: "4567" },
  ];

  const handleRoleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    const res = await loginWithStaffRole(selectedRole, pin);
    setIsSubmitting(false);

    if (res.success) {
      router.push(redirectPath);
    } else {
      setAuthError(res.error || "Authentication failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      await loginWithGoogle();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setAuthError("Google OAuth redirection error. Check Supabase Google provider configuration.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-xl mx-auto space-y-6 pt-4">
        {/* Active Session Notification if already signed in */}
        {user?.isAuthenticated && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold block">
                  Currently Signed In as: {user.fullName} ({user.role.toUpperCase()})
                </span>
                <span className="text-[11px] text-emerald-700">
                  Auth Method: {user.authMethod}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(redirectPath)}
                className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
              >
                Go to App
              </button>
              <button
                onClick={() => logout()}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Security & Role Enforcement Card */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Staff Authentication &amp; Role-Based Access</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800">
            Control Room access is strictly isolated by staff roles. Cashiers can only access counter billing; Kitchen staff can only access the KDS; only the Owner can modify settings and approve loyalty redemptions.
          </p>
        </div>

        {/* Login Form Box */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-amber-300 mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-zinc-900">
              Staff Portal Sign In
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Select your staff role or sign in with your corporate Google Account
            </p>
          </div>

          {authError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {authError}
            </div>
          )}

          {/* Option 1: Google OAuth Button */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-white py-3 px-4 text-xs font-bold text-zinc-800 hover:bg-zinc-50 shadow-xs transition active:scale-98"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
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
              <span>Sign in with Google OAuth (Owner / Staff)</span>
            </button>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5">
              Configured via Supabase Auth &bull; Requires Google Cloud Client ID
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <span className="w-full border-t border-zinc-200" />
            <span className="bg-white px-3 text-[11px] font-bold text-zinc-400 uppercase">
              Or Fast Staff Role Switch
            </span>
            <span className="w-full border-t border-zinc-200" />
          </div>

          {/* Option 2: Staff Role PIN Form */}
          <form onSubmit={handleRoleSignIn} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.id);
                    setPin(r.defaultPin);
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${
                    selectedRole === r.id
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <span className="font-bold text-xs block">{r.title}</span>
                  <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Role Access PIN (Pre-filled for fast testing)
              </label>
              <input
                type="password"
                required
                value={pin || "••••"}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Staff PIN"
                className="w-full rounded-xl border border-zinc-200 py-2.5 px-3 text-xs focus:border-zinc-800 focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow-xs active:scale-98 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              <span>
                Enter as {selectedRole.toUpperCase()} &rarr;
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ControlRoomLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-amber-400 font-mono text-sm">
          Loading Staff Portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
