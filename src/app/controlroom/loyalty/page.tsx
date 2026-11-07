"use client";

import React, { useState } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import {
  Award,
  Coffee,
  CheckCircle2,
  Gift,
  QrCode,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";

export default function ControlRoomLoyaltyPage() {
  const { customers } = useCafeStore();
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const handleSimulateRedemption = (name: string) => {
    setRedeemSuccess(
      `Owner PIN authorized: 6th Free Signature Coffee redeemed for ${name}! Digital stamp card reset to 0/5.`
    );
    setTimeout(() => setRedeemSuccess(null), 4000);
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Loyalty Rewards &amp; Stamp Engine"
        subtitle="5-stamp loyalty tracking: 5 paid visits earn 5 stamps; 6th coffee is free (Owner redemption only)"
      />

      {redeemSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{redeemSuccess}</span>
        </div>
      )}

      {/* Mechanics Explanatory Card */}
      <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                1
              </span>
              1 Paid Visit = 1 Digital Stamp
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              When a guest settles their table bill at the counter, their registered mobile number automatically logs 1 visit stamp.
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
              Upon earning 5 stamps, the digital wallet unlocks one complimentary signature pour-over or barista beverage of choice.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                3
              </span>
              Owner-Only Redemption
            </span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              To prevent cashier leakage or unauthorized discounts, only the verified café owner PIN can approve free coffee redemptions.
            </p>
          </div>
        </div>
      </div>

      {/* Customer Stamp Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-zinc-900">
            Guest Loyalty Cards Snapshot
          </h3>
          <span className="text-xs text-zinc-500">
            Connected demo store state
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {customers.map((cust) => (
            <div
              key={cust.id}
              className={`rounded-3xl border p-5 space-y-4 transition bg-white shadow-xs ${
                cust.rewardEligible
                  ? "border-amber-400 ring-2 ring-amber-400/20"
                  : "border-zinc-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-serif text-base font-bold text-zinc-900">
                    {cust.name}
                  </h4>
                  <span className="text-xs text-zinc-500 font-mono">
                    {cust.phone}
                  </span>
                </div>
                {cust.rewardEligible && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-900 uppercase">
                    Reward Unlocked
                  </span>
                )}
              </div>

              {/* 5-Stamp Visual Circles */}
              <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                <div className="flex items-center justify-between gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((idx) => {
                    const isEarned = idx <= cust.stampsEarned;
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
                  <span>Progress: {cust.stampsEarned} / 5 visits</span>
                  <span>
                    {cust.rewardEligible
                      ? "6th Drink Ready"
                      : `${5 - cust.stampsEarned} left`}
                  </span>
                </div>
              </div>

              {/* Redemption Action */}
              <div>
                {cust.rewardEligible ? (
                  <button
                    onClick={() => handleSimulateRedemption(cust.name)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow-sm active:scale-95"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Redeem 6th Free Coffee (Owner Auth)</span>
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
      </div>
    </div>
  );
}
