"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatINR } from "@/lib/utils";
import { apiUrl } from "@/lib/base-path";
import {
  Coffee,
  Calendar,
  LogOut,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  Gift,
  CheckCircle2,
  Receipt,
} from "lucide-react";

interface CustomerProfileData {
  authenticated: boolean;
  profile?: {
    id: string;
    fullName: string;
    phone: string;
    maskedPhone: string;
    createdAt: string;
  };
  loyalty?: {
    accountId: string | null;
    stampsEarned: number;
    totalVisits: number;
    totalSpent: number;
    rewardEligible: boolean;
    redemptions: {
      id: string;
      reward_description: string;
      redeemed_at: string;
    }[];
  };
  activeSession?: {
    sessionId: string;
    sessionCode: string;
    tableCode: string;
    tableName: string;
    status: string;
    openedAt: string;
    bill?: {
      id: string;
      billNumber: string;
      subtotal: number;
      taxAmount: number;
      totalPayable: number;
      status: string;
      paidAt: string | null;
    } | null;
    orders: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: number;
      createdAt: string;
      items: {
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[];
    }[];
  } | null;
  visitHistory?: {
    sessionId: string;
    sessionCode: string;
    tableCode: string;
    tableName: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
    bill?: {
      id: string;
      billNumber: string;
      subtotal: number;
      taxAmount: number;
      totalPayable: number;
      status: string;
      paidAt: string | null;
    } | null;
    orders: {
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      totalAmount: number;
      createdAt: string;
      items: {
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[];
    }[];
  }[];
}

const CACHED_PROFILE_KEY = "tbw_cached_customer_profile_v2";

export default function CustomerProfilePage() {
  const [data, setData] = useState<CustomerProfileData | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(CACHED_PROFILE_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        if (localStorage.getItem(CACHED_PROFILE_KEY)) return false;
      } catch {}
    }
    return true;
  });

  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Form for unauthenticated visitors
  const [loginName, setLoginName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const fetchProfile = useCallback(async (isInitial = false) => {
    try {
      if (isInitial && !data) {
        setLoading(true);
      }
      const res = await fetch(apiUrl("/api/customer/profile"));
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.authenticated && typeof window !== "undefined") {
          try {
            localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(json));
          } catch {}
        }
      } else {
        setData({ authenticated: false });
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(CACHED_PROFILE_KEY);
          } catch {}
        }
      }
    } catch {
      if (!data) {
        setData({ authenticated: false });
      }
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchProfile(true);
  }, [fetchProfile]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginName.trim() || loginName.trim().length < 2) {
      setLoginError("Please enter your name (at least 2 letters).");
      return;
    }
    const cleanPhone = loginPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setLoginError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setIsSubmittingLogin(true);
      const res = await fetch(apiUrl("/api/customer/identity"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: loginName.trim(), phone: cleanPhone }),
      });
      const json = await res.json();
      if (res.ok && json.authenticated) {
        // Also save to device customer session for instant table QR pickup
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              "tbw_cafe_customer_session_v4",
              JSON.stringify({ name: loginName.trim(), phone: cleanPhone })
            );
          } catch {}
        }
        await fetchProfile();
      } else {
        setLoginError(json.error || "Unable to start session.");
      }
    } catch {
      setLoginError("Network connection error.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const confirmLogout = async () => {
    try {
      await fetch(apiUrl("/api/customer/identity"), { method: "DELETE" });
      setData({ authenticated: false });
      setIsLogoutConfirmOpen(false);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(CACHED_PROFILE_KEY);
          localStorage.removeItem("tbw_cafe_customer_session_v4");
        } catch {}
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 selection:bg-amber-200">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        {loading && !data ? (
          /* LUXURY SKELETON LOADER (Zero blank spinner screen) */
          <div className="space-y-6 animate-pulse">
            <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-zinc-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-40 rounded-lg bg-zinc-800" />
                  <div className="h-3 w-28 rounded-lg bg-zinc-800/60" />
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 border border-zinc-200 shadow-xs space-y-4">
              <div className="h-4 w-32 rounded bg-zinc-200" />
              <div className="grid grid-cols-5 gap-3 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 rounded-2xl bg-zinc-100" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-white border border-zinc-200 p-4" />
              ))}
            </div>
          </div>
        ) : !data?.authenticated || !data?.profile ? (
          /* UNRECOGNIZED VISITOR SIGN-IN */
          <div className="max-w-md mx-auto my-8 rounded-3xl border border-amber-900/10 bg-white p-7 sm:p-8 shadow-xl text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-950 shadow-md ring-4 ring-amber-100">
              <Coffee className="h-8 w-8" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-amber-800 uppercase">
                Brew &amp; Bean Artisan Club
              </span>
              <h1 className="font-serif text-2xl font-bold text-zinc-900 mt-1">
                Guest Member Profile
              </h1>
              <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                Enter your mobile number to view your active table bill, unlock 5-stamp loyalty coffee rewards, and track previous orders.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aman Rajbhar"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Mobile Number (10 digits)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-zinc-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    maxLength={10}
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 pl-11 pr-3.5 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none font-mono transition"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200 font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-950 py-3.5 text-xs font-bold text-white hover:from-black hover:to-zinc-900 disabled:opacity-50 transition shadow-md active:scale-98"
              >
                {isSubmittingLogin ? (
                  <span>Accessing Profile...</span>
                ) : (
                  <>
                    <span>Open My Profile &amp; Stamp Card</span>
                    <ArrowRight className="h-4 w-4 text-amber-300" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED CUSTOMER PROFILE */
          <div className="space-y-6">
            {/* 1. Luxury Obsidian & Amber VIP Member Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950 p-6 sm:p-7 text-white shadow-xl border border-amber-900/30">
              {/* Subtle decorative radial glow */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-amber-600/10 blur-2xl" />

              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="flex items-center gap-4">
                  {/* Monogram Badge */}
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 text-zinc-950 font-serif text-2xl font-black shadow-lg ring-4 ring-amber-400/20">
                    {data.profile.fullName.charAt(0).toUpperCase()}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-zinc-900">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
                        {data.profile.fullName}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-400/30 backdrop-blur-xs">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        Artisan VIP
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-300 flex-wrap">
                      <span className="flex items-center gap-1.5 font-mono text-zinc-200">
                        <Phone className="h-3.5 w-3.5 text-amber-400" />
                        {data.profile.maskedPhone}
                      </span>
                      <span className="text-zinc-600">&bull;</span>
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                        Member since {new Date(data.profile.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold text-zinc-200 hover:text-white border border-white/15 px-4 py-2.5 backdrop-blur-xs transition self-start sm:self-center shadow-xs"
                >
                  <LogOut className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Switch Customer</span>
                </button>
              </div>
            </div>

            {/* 2. Active Table Session Pass (if seated) */}
            {data.activeSession && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-amber-500/10 p-4 sm:p-5 shadow-sm backdrop-blur-xs flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 shadow-md">
                    <Coffee className="h-6 w-6" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                        Live Table Pass
                      </span>
                      <h2 className="text-sm font-bold text-zinc-900">
                        Seated at {data.activeSession.tableName}
                      </h2>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Running Bill:{" "}
                      <strong className="font-bold text-zinc-900 font-mono">
                        {formatINR(
                          data.activeSession.bill?.totalPayable ||
                            data.activeSession.orders.reduce(
                              (sum, o) => sum + o.totalAmount,
                              0
                            )
                        )}
                      </strong>
                      <span className="text-zinc-400 mx-1.5">&bull;</span>
                      <span>
                        {data.activeSession.orders.length} order round
                        {data.activeSession.orders.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                </div>

                <Link
                  href={`/t/${data.activeSession.tableCode}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 shadow-md transition active:scale-95"
                >
                  <span>Open Table Menu</span>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-300" />
                </Link>
              </div>
            )}

            {/* 3. Artisan 5-Stamp Digital Stamp Passport */}
            <div className="rounded-3xl border border-amber-900/10 bg-white p-5 sm:p-7 shadow-lg space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-700 uppercase">
                    Brew &amp; Bean Club Rewards
                  </span>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2 mt-0.5">
                    5-Stamp Coffee Passport
                    {data.loyalty?.rewardEligible && (
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs animate-bounce">
                        FREE COFFEE UNLOCKED!
                      </span>
                    )}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Current Progress
                    </span>
                    <span className="font-serif text-base sm:text-lg font-black text-amber-700">
                      {data.loyalty?.stampsEarned || 0}{" "}
                      <span className="text-zinc-400 text-xs font-sans">
                        / 5 Stamps
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Stamp Slots */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3.5 py-1">
                {[1, 2, 3, 4, 5].map((stampIndex) => {
                  const isEarned = (data.loyalty?.stampsEarned || 0) >= stampIndex;
                  const isFifth = stampIndex === 5;

                  return (
                    <div
                      key={stampIndex}
                      className={`relative flex flex-col items-center justify-center rounded-2xl py-3.5 px-1.5 text-center transition-all ${
                        isEarned
                          ? "bg-gradient-to-b from-amber-50 to-amber-100/60 border-2 border-amber-500 shadow-xs"
                          : isFifth
                          ? "bg-gradient-to-b from-amber-500/10 to-transparent border-2 border-dashed border-amber-400/60"
                          : "bg-zinc-50 border-2 border-dashed border-zinc-200"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full mb-1.5 transition-transform ${
                          isEarned
                            ? "bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 shadow-md ring-2 ring-amber-300 scale-105"
                            : isFifth
                            ? "bg-amber-100/70 text-amber-700"
                            : "bg-zinc-200/70 text-zinc-400"
                        }`}
                      >
                        {isFifth ? (
                          <Gift className="h-5 w-5" />
                        ) : isEarned ? (
                          <CheckCircle2 className="h-5 w-5 text-zinc-950 stroke-[2.5]" />
                        ) : (
                          <Coffee className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`text-[9px] sm:text-[10px] font-black uppercase tracking-tight ${
                          isEarned
                            ? "text-amber-950"
                            : isFifth
                            ? "text-amber-700"
                            : "text-zinc-400"
                        }`}
                      >
                        {isFifth ? "Free Coffee" : `Visit ${stampIndex}`}
                      </span>
                      {isEarned && (
                        <span className="text-[8px] font-bold text-amber-700 tracking-tighter">
                          Verified
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-semibold text-zinc-500">
                  <span>Passport Completion</span>
                  <span className="font-bold text-zinc-900 font-mono">
                    {Math.min(
                      100,
                      Math.round(((data.loyalty?.stampsEarned || 0) / 5) * 100)
                    )}
                    %
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((data.loyalty?.stampsEarned || 0) / 5) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Reward Explanation Callout */}
              <div
                className={`rounded-2xl p-4 text-xs flex items-start gap-3 border ${
                  data.loyalty?.rewardEligible
                    ? "bg-gradient-to-r from-emerald-50 via-emerald-100/50 to-emerald-50 border-emerald-300 text-emerald-950 shadow-sm"
                    : "bg-gradient-to-r from-amber-50 via-orange-50/30 to-amber-50 border-amber-200/70 text-zinc-700"
                }`}
              >
                <Sparkles
                  className={`h-5 w-5 shrink-0 mt-0.5 ${
                    data.loyalty?.rewardEligible
                      ? "text-emerald-600 animate-spin"
                      : "text-amber-600"
                  }`}
                />
                <div className="text-[11px] leading-relaxed">
                  {data.loyalty?.rewardEligible ? (
                    <p className="font-bold text-emerald-950">
                      🎉 Congratulations! You have completed 5 qualifying visits!
                      Inform the counter cashier on your next order to redeem
                      your <strong>Complimentary Handcrafted Coffee</strong>.
                    </p>
                  ) : (
                    <p>
                      Earn <strong>1 stamp per completed dining visit</strong>.
                      Collect 5 stamps to unlock a complimentary handcrafted coffee
                      on your 6th visit!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Lifetime Metrics Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs hover:shadow-md transition">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Completed Visits
                  </span>
                  <Calendar className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-serif text-2xl font-bold text-zinc-900 block">
                  {data.loyalty?.totalVisits || 0}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Settled dining sessions
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs hover:shadow-md transition">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Lifetime Spend
                  </span>
                  <Receipt className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-serif text-2xl font-bold text-zinc-900 block font-mono">
                  {formatINR(data.loyalty?.totalSpent || 0)}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Total counter receipts
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs hover:shadow-md transition">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Active Stamps
                  </span>
                  <Coffee className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-serif text-2xl font-bold text-amber-600 block">
                  {data.loyalty?.stampsEarned || 0} / 5
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Current cycle progress
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs hover:shadow-md transition">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Free Rewards
                  </span>
                  <Gift className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-serif text-2xl font-bold text-zinc-900 block">
                  {data.loyalty?.redemptions?.length || 0}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Claimed coffees
                </span>
              </div>
            </div>

            {/* 5. Cross-Table Visit History Accordion */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-zinc-900">
                    Previous Dining Visits
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Itemized cross-table receipts &amp; order rounds
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                  {data.visitHistory?.length || 0} visit
                  {data.visitHistory?.length === 1 ? "" : "s"}
                </span>
              </div>

              {!data.visitHistory || data.visitHistory.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">
                    No previous settled visits recorded on this device yet.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    When your counter cashier settles your table bill, your
                    itemized invoice will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.visitHistory.map((visit) => {
                    const isExpanded = expandedVisit === visit.sessionId;
                    const totalItems = visit.orders.reduce(
                      (acc, o) =>
                        acc +
                        o.items.reduce((s, it) => s + it.quantity, 0),
                      0
                    );

                    return (
                      <div
                        key={visit.sessionId}
                        className="rounded-2xl border border-zinc-200/90 overflow-hidden shadow-xs hover:border-amber-300 transition"
                      >
                        <button
                          onClick={() =>
                            setExpandedVisit(
                              isExpanded ? null : visit.sessionId
                            )
                          }
                          className="w-full flex items-center justify-between p-4 bg-zinc-50/70 hover:bg-amber-50/40 text-left transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-zinc-950 px-3 py-1.5 text-xs font-black text-amber-300 font-mono shadow-xs">
                              Table {visit.tableCode}
                            </span>
                            <div>
                              <span className="font-bold text-xs text-zinc-900 block">
                                {new Date(visit.openedAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {totalItems} item{totalItems === 1 ? "" : "s"}{" "}
                                &bull; {visit.orders.length} round
                                {visit.orders.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-zinc-900">
                              {formatINR(visit.bill?.totalPayable || 0)}
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-500">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 sm:p-5 bg-white border-t border-zinc-100 space-y-3 text-xs">
                            {visit.orders.map((ord) => (
                              <div
                                key={ord.id}
                                className="rounded-xl bg-zinc-50/60 p-3 border border-zinc-100 space-y-2"
                              >
                                <div className="flex justify-between items-center text-[11px] font-bold text-zinc-800 border-b border-zinc-200/60 pb-1.5">
                                  <span className="font-mono">
                                    {ord.orderNumber}
                                  </span>
                                  <span className="font-mono text-amber-900">
                                    {formatINR(ord.totalAmount)}
                                  </span>
                                </div>
                                <div className="divide-y divide-zinc-100">
                                  {ord.items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="py-1.5 flex justify-between text-[11px] text-zinc-600"
                                    >
                                      <span className="font-medium">
                                        {it.quantity} &times; {it.name}
                                      </span>
                                      <span className="font-mono">
                                        {formatINR(it.totalPrice)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Logout Confirmation Dialog (Replaces browser confirm) */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Switch Customer Session?"
        message={`This will revoke the remembered device session for ${data?.profile?.fullName || "this device"}. You can enter another guest's mobile number or order as a new visitor.`}
        confirmLabel="Switch Customer"
        cancelLabel="Keep Session"
        variant="warning"
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      <Footer />
    </div>
  );
}
