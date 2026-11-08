"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatINR } from "@/lib/utils";
import {
  Coffee,
  Calendar,
  LogOut,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Gift,
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
      const res = await fetch("/api/customer/profile");
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
      const res = await fetch("/api/customer/identity", {
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
      await fetch("/api/customer/identity", { method: "DELETE" });
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cafe-900 border-t-transparent" />
            <p className="text-xs font-semibold text-zinc-500">
              Loading your café profile &amp; stamp card...
            </p>
          </div>
        ) : !data?.authenticated || !data?.profile ? (
          /* UNRECOGNIZED VISITOR VIEW */
          <div className="max-w-md mx-auto my-8 rounded-3xl border border-zinc-200 bg-white p-7 shadow-xs text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
              <User className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-zinc-900">
                Café Member Profile &amp; Loyalty
              </h1>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Scan your table QR code or sign in below with your mobile number to view your 5-stamp loyalty card and visit history.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5 text-left pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aman Sharma"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Mobile Number (10 digits)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-semibold text-zinc-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    maxLength={10}
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 pl-11 pr-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-950 py-3 text-xs font-bold text-white hover:bg-cafe-900 disabled:opacity-50 transition shadow-xs"
              >
                {isSubmittingLogin ? (
                  <span>Checking Session...</span>
                ) : (
                  <>
                    <span>Access My Profile</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED CUSTOMER PROFILE */
          <div className="space-y-5">
            {/* Top Profile Header Card */}
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-cafe-950 font-serif text-2xl font-black shadow-xs shrink-0">
                  {data.profile.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900">
                      {data.profile.fullName}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                      <ShieldCheck className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-zinc-400" />
                      {data.profile.maskedPhone}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-zinc-400" />
                      Since{" "}
                      {new Date(data.profile.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition self-start sm:self-center"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Switch Customer</span>
              </button>
            </div>

            {/* Active Table Session Banner (if seated) */}
            {data.activeSession && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/80 p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-cafe-950 font-bold shrink-0">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-amber-950">
                      Seated at: {data.activeSession.tableName}
                    </h2>
                    <p className="text-[11px] text-amber-800">
                      Running Bill:{" "}
                      <strong>
                        {formatINR(
                          data.activeSession.bill?.totalPayable ||
                            data.activeSession.orders.reduce(
                              (sum, o) => sum + o.totalAmount,
                              0
                            )
                        )}
                      </strong>{" "}
                      ({data.activeSession.orders.length} round
                      {data.activeSession.orders.length === 1 ? "" : "s"})
                    </p>
                  </div>
                </div>

                <Link
                  href={`/t/${data.activeSession.tableCode}`}
                  className="inline-flex items-center gap-1 rounded-xl bg-cafe-950 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cafe-900 transition"
                >
                  <span>Go to Table Menu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* 5-Stamp Visual Loyalty Card */}
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-amber-800 uppercase">
                    Brew &amp; Bean Rewards
                  </span>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-zinc-900 flex items-center gap-2">
                    5-Stamp Coffee Loyalty Card
                    {data.loyalty?.rewardEligible && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                        FREE COFFEE READY!
                      </span>
                    )}
                  </h2>
                </div>
                <span className="text-xs font-black text-cafe-950">
                  {data.loyalty?.stampsEarned || 0} / 5 Stamps
                </span>
              </div>

              {/* 5 Stamp Circles */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2">
                {[1, 2, 3, 4, 5].map((stampIndex) => {
                  const isEarned = (data.loyalty?.stampsEarned || 0) >= stampIndex;
                  const isFifth = stampIndex === 5;

                  return (
                    <div
                      key={stampIndex}
                      className={`relative flex flex-col items-center justify-center rounded-2xl py-3 px-1 text-center transition border-2 ${
                        isEarned
                          ? "border-amber-500 bg-amber-50/80 shadow-2xs"
                          : "border-dashed border-zinc-200 bg-zinc-50/60"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full mb-1 ${
                          isEarned
                            ? "bg-amber-400 text-cafe-950 shadow-xs"
                            : "bg-zinc-200 text-zinc-400"
                        }`}
                      >
                        {isFifth ? (
                          <Gift className="h-4.5 w-4.5" />
                        ) : (
                          <Coffee className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <span
                        className={`text-[9px] sm:text-[10px] font-black uppercase tracking-tight ${
                          isEarned ? "text-amber-950" : "text-zinc-400"
                        }`}
                      >
                        {isFifth ? "Free Coffee" : `Stamp ${stampIndex}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status explanation */}
              <div className="rounded-2xl bg-[#FAF7F2] p-3.5 text-xs text-zinc-700 flex items-start gap-2.5 border border-amber-200/50">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  {data.loyalty?.rewardEligible ? (
                    <p className="font-bold text-emerald-950">
                      🎉 You have completed 5 eligible visits! Mention this to the cashier to claim your <strong>Complimentary 6th Specialty Coffee</strong>!
                    </p>
                  ) : (
                    <p>
                      Receive <strong>1 stamp per completed paid dining visit</strong>. Collect 5 stamps to unlock a free artisanal coffee of your choice.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Lifetime Spend & Visit Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Completed Visits
                </span>
                <span className="font-serif text-2xl font-bold text-zinc-900 mt-1 block">
                  {data.loyalty?.totalVisits || 0}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Lifetime Spend
                </span>
                <span className="font-serif text-2xl font-bold text-zinc-900 mt-1 block">
                  {formatINR(data.loyalty?.totalSpent || 0)}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Current Stamps
                </span>
                <span className="font-serif text-2xl font-bold text-amber-600 mt-1 block">
                  {data.loyalty?.stampsEarned || 0} / 5
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Free Rewards Claimed
                </span>
                <span className="font-serif text-2xl font-bold text-zinc-900 mt-1 block">
                  {data.loyalty?.redemptions?.length || 0}
                </span>
              </div>
            </div>

            {/* Cross-Table Visit History */}
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-zinc-900">
                    Previous Dining Visits
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Itemized history across all tables you have dined at
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-700">
                  {data.visitHistory?.length || 0} visits
                </span>
              </div>

              {(!data.visitHistory || data.visitHistory.length === 0) ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  No previous settled visits recorded on this device yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.visitHistory.map((visit) => {
                    const isExpanded = expandedVisit === visit.sessionId;
                    const totalItems = visit.orders.reduce(
                      (acc, o) => acc + o.items.reduce((s, it) => s + it.quantity, 0),
                      0
                    );

                    return (
                      <div
                        key={visit.sessionId}
                        className="rounded-2xl border border-zinc-200 overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedVisit(isExpanded ? null : visit.sessionId)
                          }
                          className="w-full flex items-center justify-between p-3.5 bg-zinc-50/60 hover:bg-zinc-50 text-left transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-black text-amber-300">
                              Table {visit.tableCode}
                            </span>
                            <div>
                              <span className="font-bold text-xs text-zinc-900 block">
                                {new Date(visit.openedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {totalItems} items &bull; {visit.orders.length} round
                                {visit.orders.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-black text-xs text-zinc-900">
                              {formatINR(visit.bill?.totalPayable || 0)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-zinc-100 space-y-3 text-xs">
                            {visit.orders.map((ord) => (
                              <div key={ord.id} className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold text-zinc-700">
                                  <span>{ord.orderNumber}</span>
                                  <span>{formatINR(ord.totalAmount)}</span>
                                </div>
                                <div className="divide-y divide-zinc-50 pl-2">
                                  {ord.items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="py-1 flex justify-between text-[11px] text-zinc-600"
                                    >
                                      <span>
                                        {it.quantity} &times; {it.name}
                                      </span>
                                      <span>{formatINR(it.totalPrice)}</span>
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
