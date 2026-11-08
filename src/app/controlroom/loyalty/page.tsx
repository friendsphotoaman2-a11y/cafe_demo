"use client";

import React, { useState, useEffect, useCallback } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { formatINR } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Award,
  Coffee,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertCircle,
  History,
} from "lucide-react";

interface RealLoyaltyAccount {
  id: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  stamps: number;
  totalVisits: number;
  totalSpent: number;
  rewardEligible: boolean;
  redemptions: {
    id: string;
    reward_description: string;
    redeemed_at: string;
  }[];
  lastUpdated: string;
}

export default function ControlRoomLoyaltyPage() {
  const [accounts, setAccounts] = useState<RealLoyaltyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  const [confirmAccount, setConfirmAccount] = useState<RealLoyaltyAccount | null>(null);

  const fetchLoyalty = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/controlroom/loyalty");
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.loyaltyAccounts || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  const handleRedeemClick = (acc: RealLoyaltyAccount) => {
    if (!acc.rewardEligible && acc.stamps < 5) {
      setActionMsg({
        type: "error",
        text: `Customer has only ${acc.stamps}/5 stamps. 5 paid visits are required.`,
      });
      return;
    }
    setConfirmAccount(acc);
  };

  const executeRedeem = async () => {
    if (!confirmAccount) return;
    const acc = confirmAccount;
    setConfirmAccount(null);

    try {
      setIsRedeeming(acc.id);
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltyAccountId: acc.id,
          customerId: acc.customerId,
          rewardDescription: "6th Complimentary Artisan Coffee",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setActionMsg({
          type: "success",
          text: `Success: Free Coffee redeemed for ${acc.customerName}! Digital stamp card reset to 0/5 for the next cycle.`,
        });
        await fetchLoyalty();
      } else {
        setActionMsg({
          type: "error",
          text: json.error || "Failed to redeem reward.",
        });
      }
    } catch {
      setActionMsg({
        type: "error",
        text: "Network error during redemption.",
      });
    } finally {
      setIsRedeeming(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Loyalty Rewards &amp; Stamp Engine"
        subtitle="5-stamp loyalty tracking: 5 paid visits earn 5 stamps; 6th coffee is free (Owner/Manager redemption only)"
      />

      {actionMsg && (
        <div
          className={`rounded-2xl border p-4 flex items-center gap-3 animate-fade-in shadow-xs ${
            actionMsg.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          {actionMsg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span className="text-xs font-bold">{actionMsg.text}</span>
        </div>
      )}

      {/* Mechanics Explanatory Card */}
      <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-sm">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-zinc-900">
                The 5-Stamp Digital Card Philosophy
              </h3>
              <p className="text-xs text-zinc-600">
                Simple, transparent, fraud-proof customer loyalty without complicated points or mobile apps.
              </p>
            </div>
          </div>

          <button
            onClick={fetchLoyalty}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Live Loyalty</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                1
              </span>
              1 Paid Visit = 1 Digital Stamp
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              When a guest settles their table bill at the counter, their registered account automatically earns 1 visit stamp.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                2
              </span>
              5 Stamps = 6th Coffee Free
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Upon completing 5 qualifying visits, the customer unlocks one complimentary signature barista beverage.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                3
              </span>
              Staff-Authorized Redemption
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Only verified Owner or Store Manager credentials can approve free coffee redemptions. After redemption, stamps reset to 0 for a new cycle.
            </p>
          </div>
        </div>
      </div>

      {/* Customer Stamp Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-zinc-900">
            Guest Loyalty Cards ({accounts.length})
          </h3>
          <span className="text-xs text-zinc-500">
            Authoritative Supabase State
          </span>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-xs text-zinc-400">
            Loading loyalty accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-xs text-zinc-400">
            No customer loyalty accounts recorded yet. Digital stamp cards are automatically activated when guests place and settle their table QR orders.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`rounded-3xl border p-5 space-y-4 transition bg-white shadow-xs ${
                  acc.rewardEligible
                    ? "border-amber-400 ring-2 ring-amber-400/20"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-serif text-base font-bold text-zinc-900">
                      {acc.customerName}
                    </h4>
                    <span className="text-xs text-zinc-500 font-mono">
                      {acc.customerPhone}
                    </span>
                  </div>
                  {acc.rewardEligible && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-900 uppercase">
                      Reward Unlocked
                    </span>
                  )}
                </div>

                {/* 5-Stamp Visual Circles */}
                <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((idx) => {
                      const isEarned = idx <= acc.stamps;
                      return (
                        <div
                          key={idx}
                          className={`flex h-11 w-11 flex-col items-center justify-center rounded-2xl transition ${
                            isEarned
                              ? "bg-amber-400 text-zinc-950 font-black shadow-xs ring-2 ring-amber-300"
                              : "border-2 border-dashed border-zinc-300 bg-white text-zinc-300"
                          }`}
                        >
                          {isEarned ? (
                            <Coffee className="h-5 w-5" />
                          ) : (
                            <span className="text-xs font-bold text-zinc-400">
                              {idx}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span>Progress: {acc.stamps} / 5 visits</span>
                    <span>
                      {acc.rewardEligible
                        ? "6th Drink Ready"
                        : `${5 - acc.stamps} left`}
                    </span>
                  </div>
                </div>

                {/* Lifetime spend & visits */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-100 pt-2">
                  <span>{acc.totalVisits} completed visits</span>
                  <span className="font-bold text-zinc-800">
                    {formatINR(acc.totalSpent)} spent
                  </span>
                </div>

                {/* Past redemptions */}
                {acc.redemptions && acc.redemptions.length > 0 && (
                  <div className="rounded-xl bg-amber-50/60 p-2 text-[10px] text-amber-900 flex items-center gap-1.5">
                    <History className="h-3 w-3 shrink-0" />
                    <span>
                      {acc.redemptions.length} previous reward
                      {acc.redemptions.length === 1 ? "" : "s"} redeemed
                    </span>
                  </div>
                )}

                {/* Redemption Action */}
                <div>
                  {acc.rewardEligible || acc.stamps >= 5 ? (
                    <button
                      onClick={() => handleRedeemClick(acc)}
                      disabled={isRedeeming === acc.id}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        {isRedeeming === acc.id
                          ? "Processing..."
                          : "Redeem 6th Free Coffee (Owner Auth)"}
                      </span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-xl bg-zinc-100 py-2.5 text-xs font-medium text-zinc-400 cursor-not-allowed"
                    >
                      Requires 5 Validated Stamps
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAccount !== null}
        title="Authorize Free Coffee Reward"
        message={`Are you sure you want to authorize redemption of the 6th Free Artisan Coffee for ${confirmAccount?.customerName || "this customer"}? This will reset their current stamp card to 0/5 for the next cycle.`}
        confirmLabel="Authorize & Redeem"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={executeRedeem}
        onCancel={() => setConfirmAccount(null)}
      />
    </div>
  );
}
