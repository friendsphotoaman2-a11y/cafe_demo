"use client";

import React, { useState } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import { formatINR } from "@/lib/utils";
import {
  Users,
  Search,
  Award,
  Phone,
  Calendar,
  Coffee,
  CheckCircle2,
  Gift,
} from "lucide-react";

export default function ControlRoomCustomersPage() {
  const { customers } = useCafeStore();
  const [search, setSearch] = useState("");

  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const rewardEligibleCount = customers.filter((c) => c.rewardEligible).length;

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Customer Directory &amp; Dining Profiles"
        subtitle="Guest history, lifetime spend, visits count, and loyalty reward statuses"
      />

      {/* Search and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="relative max-w-sm w-full">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name or phone..."
            className="w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-xs focus:border-zinc-800 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="font-semibold">
            {customers.length} Registered Guests
          </span>
          <span className="h-3 w-px bg-zinc-300" />
          <span className="text-amber-700 font-bold flex items-center gap-1">
            <Gift className="h-3.5 w-3.5" />
            {rewardEligibleCount} Ready for Free Coffee
          </span>
        </div>
      </div>

      {/* Customers Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Mobile Phone</th>
                <th className="py-3.5 px-4">Total Visits</th>
                <th className="py-3.5 px-4">Lifetime Spend</th>
                <th className="py-3.5 px-4">Loyalty Stamps</th>
                <th className="py-3.5 px-4">Reward Status</th>
                <th className="py-3.5 px-4">Favorite Dish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500 text-xs">
                    No customer profiles yet. New guest profiles will be recorded here automatically as orders are placed via table QR codes.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-zinc-50/60 transition">
                  {/* Name */}
                  <td className="py-3.5 px-4 font-bold text-zinc-900">
                    {cust.name}
                    <span className="block text-[10px] text-zinc-400 font-normal">
                      Last visit: {cust.lastVisit}
                    </span>
                  </td>

                  {/* Phone */}
                  <td className="py-3.5 px-4 text-zinc-600 font-mono">
                    {cust.phone}
                  </td>

                  {/* Visits */}
                  <td className="py-3.5 px-4 font-bold text-zinc-800">
                    {cust.visitsCount} visits
                  </td>

                  {/* Spend */}
                  <td className="py-3.5 px-4 font-extrabold text-zinc-900">
                    {formatINR(cust.totalSpent)}
                  </td>

                  {/* Stamps Visual */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <span
                          key={idx}
                          className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            idx <= cust.stampsEarned
                              ? "bg-amber-400 text-zinc-950 font-black shadow-xs"
                              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                          }`}
                        >
                          {idx <= cust.stampsEarned ? "★" : idx}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Reward Eligibility */}
                  <td className="py-3.5 px-4">
                    {cust.rewardEligible ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900 border border-emerald-300">
                        <Gift className="h-3 w-3" />
                        Free 6th Coffee Ready
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500">
                        {5 - cust.stampsEarned} more visit for free coffee
                      </span>
                    )}
                  </td>

                  {/* Favorite Item */}
                  <td className="py-3.5 px-4 text-zinc-600 font-medium">
                    {cust.favoriteItem}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
