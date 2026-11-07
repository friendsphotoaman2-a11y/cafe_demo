"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { formatINR } from "@/lib/utils";
import {
  Coffee,
  Calendar,
  LogOut,
  Sparkles,
  ShoppingBag,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Receipt,
  User,
  Phone,
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

export default function CustomerProfilePage() {
  const [data, setData] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  // Form for unauthenticated visitors
  const [loginName, setLoginName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customer/profile");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData({ authenticated: false });
      }
    } catch {
      setData({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
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

  const handleLogout = async () => {
    try {
      await fetch("/api/customer/identity", { method: "DELETE" });
      setData({ authenticated: false });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 selection:bg-amber-200">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cafe-900 border-t-transparent" />
            <p className="text-xs font-semibold text-zinc-500">
              Loading your café profile &amp; stamp card...
            </p>
          </div>
        ) : !data?.authenticated || !data?.profile ? (
          /* ============================================================== */
          /* UNRECOGNIZED DEVICE VIEW                                       */
          /* ============================================================== */
          <div className="max-w-md mx-auto my-8 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 mb-4">
              <User className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-zinc-900">
              My Café Profile &amp; Loyalty
            </h1>
            <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
              Scan any café table QR code or enter your registered phone number below to access your visit history, running bill and 5-stamp loyalty card.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aman Sharma"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none"
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
                    className="w-full rounded-xl border border-zinc-300 pl-11 pr-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none font-mono"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-xs font-bold text-white hover:bg-cafe-800 disabled:opacity-50 transition"
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
          /* ============================================================== */
          /* AUTHENTICATED CUSTOMER PROFILE VIEW                            */
          /* ============================================================== */
          <div className="space-y-6">
            {/* Top Profile Card */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-cafe-950 font-serif text-2xl font-black shadow-sm shrink-0">
                  {data.profile.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-serif text-2xl font-bold text-zinc-900">
                      {data.profile.fullName}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                      <ShieldCheck className="h-3 w-3" />
                      Verified Member
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      {data.profile.maskedPhone}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                      Member since{" "}
                      {new Date(data.profile.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition self-start md:self-center"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Switch Customer</span>
              </button>
            </div>

            {/* Active Table Session Banner (if currently seated) */}
            {data.activeSession && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-cafe-950 font-bold shrink-0">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-amber-950">
                      Active Table Session: {data.activeSession.tableName}
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cafe-900 px-4 py-2 text-xs font-bold text-white hover:bg-cafe-800 transition"
                >
                  <span>Go to Table Menu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* 5-Stamp Visual Loyalty Card */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-amber-800 uppercase">
                    Brew &amp; Bean Rewards
                  </span>
                  <h2 className="font-serif text-xl font-bold text-zinc-900 flex items-center gap-2">
                    5-Stamp Coffee Loyalty Card
                    {data.loyalty?.rewardEligible && (
                      <span className="animate-pulse rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
                        REWARD READY!
                      </span>
                    )}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-cafe-900">
                    {data.loyalty?.stampsEarned || 0} / 5 Stamps
                  </span>
                </div>
              </div>

              {/* 5 Stamp Circles */}
              <div className="grid grid-cols-5 gap-2 sm:gap-4 my-6">
                {[1, 2, 3, 4, 5].map((stampIndex) => {
                  const isEarned =
                    (data.loyalty?.stampsEarned || 0) >= stampIndex;
                  const isFifth = stampIndex === 5;

                  return (
                    <div
                      key={stampIndex}
                      className={`relative flex flex-col items-center justify-center rounded-2xl py-4 px-2 text-center transition border-2 ${
                        isEarned
                          ? "border-amber-500 bg-amber-50/80 shadow-xs"
                          : "border-dashed border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full mb-1 ${
                          isEarned
                            ? "bg-amber-500 text-cafe-950 shadow-sm"
                            : "bg-zinc-200 text-zinc-400"
                        }`}
                      >
                        {isFifth ? (
                          <Sparkles className="h-5 w-5" />
                        ) : (
                          <Coffee className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase ${
                          isEarned ? "text-amber-900" : "text-zinc-400"
                        }`}
                      >
                        {isFifth ? "Free Coffee" : `Visit ${stampIndex}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Loyalty Status Guidance */}
              <div className="rounded-2xl bg-[#FAF7F2] p-4 text-xs text-zinc-700 flex items-start gap-3 border border-amber-200/50">
                <Coffee className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  {data.loyalty?.rewardEligible ? (
                    <p className="font-bold text-emerald-900">
                      🎉 Congratulations! You have completed 5 visits. Show this screen to the cashier on your next order to redeem your <strong>Complimentary 6th Artisan Coffee</strong>!
                    </p>
                  ) : (
                    <p>
                      Earn <strong>1 stamp per fully paid dining visit</strong>. Collect 5 stamps to unlock a complimentary handcrafted coffee of your choice.
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    Stamps are credited automatically to your phone account upon cashier settlement.
                  </p>
                </div>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Completed Visits
                </span>
                <span className="font-serif text-2xl font-bold text-zinc-900 mt-1 block">
                  {data.loyalty?.totalVisits || 0}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Lifetime Spend
                </span>
                <span className="font-serif text-2xl font-bold text-zinc-900 mt-1 block">
                  {formatINR(data.loyalty?.totalSpent || 0)}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Current Stamps
                </span>
                <span className="font-serif text-2xl font-bold text-amber-700 mt-1 block">
                  {data.loyalty?.stampsEarned || 0} / 5
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Rewards Redeemed
                </span>
                <span className="font-serif text-2xl font-bold text-emerald-700 mt-1 block">
                  {data.loyalty?.redemptions?.length || 0}
                </span>
              </div>
            </div>

            {/* Visit & Order History */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Visit &amp; Order History
                </h2>
                <span className="text-xs font-semibold text-zinc-400">
                  {data.visitHistory?.length || 0} total visit
                  {(data.visitHistory?.length || 0) === 1 ? "" : "s"}
                </span>
              </div>

              {!data.visitHistory || data.visitHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                  No previous dining visits recorded yet. Your completed table orders will appear here automatically.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {data.visitHistory.map((visit) => {
                    const isExpanded = expandedVisit === visit.sessionId;
                    const totalItemsCount = visit.orders.reduce(
                      (acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0),
                      0
                    );

                    return (
                      <div key={visit.sessionId} className="py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedVisit(isExpanded ? null : visit.sessionId)
                          }
                          className="w-full flex items-center justify-between text-left hover:text-amber-700 transition"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-zinc-900">
                                {visit.tableName}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  visit.status === "closed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {visit.status === "closed" ? "Completed" : "Active"}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {new Date(visit.openedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" "}&bull; {visit.orders.length} round
                              {visit.orders.length === 1 ? "" : "s"} ({totalItemsCount} item
                              {totalItemsCount === 1 ? "" : "s"})
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-serif text-base font-bold text-zinc-900">
                              {formatINR(
                                visit.bill?.totalPayable ||
                                  visit.orders.reduce((sum, o) => sum + o.totalAmount, 0)
                              )}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-400" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Order Items */}
                        {isExpanded && (
                          <div className="mt-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4 space-y-4 text-xs">
                            {/* Bill metadata */}
                            {visit.bill && (
                              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-[11px] text-zinc-500">
                                <span className="flex items-center gap-1 font-mono">
                                  <Receipt className="h-3 w-3" />
                                  {visit.bill.billNumber}
                                </span>
                                <span>
                                  Settled at counter &bull; Status:{" "}
                                  <strong className="text-emerald-700 capitalize">
                                    {visit.bill.status}
                                  </strong>
                                </span>
                              </div>
                            )}

                            {/* Orders */}
                            {visit.orders.map((ord, idx) => (
                              <div key={ord.id} className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                                  <span>
                                    Round {idx + 1} ({ord.orderNumber})
                                  </span>
                                  <span>{formatINR(ord.totalAmount)}</span>
                                </div>
                                <div className="divide-y divide-zinc-100 rounded-xl bg-white border border-zinc-200/60 p-2 space-y-1">
                                  {ord.items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="flex items-center justify-between text-[11px] py-1"
                                    >
                                      <span className="text-zinc-800">
                                        {it.quantity} &times; {it.name}
                                      </span>
                                      <span className="font-semibold text-zinc-700">
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

      <Footer />
    </div>
  );
}
