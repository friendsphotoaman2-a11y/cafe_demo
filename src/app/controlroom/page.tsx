"use client";

import React from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import {
  DEMO_ORDERS,
  DEMO_TABLES,
  DEMO_CUSTOMERS,
  DEMO_SETTINGS,
} from "@/lib/demo-data";
import { formatINR } from "@/lib/utils";
import {
  DollarSign,
  Grid,
  ChefHat,
  Award,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ReceiptText,
} from "lucide-react";

export default function ControlRoomDashboardPage() {
  const activeTablesCount = DEMO_TABLES.filter(
    (t) => t.status !== "available"
  ).length;

  const pendingOrders = DEMO_ORDERS.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  );

  const todayRevenue = DEMO_ORDERS.reduce((acc, o) => acc + o.totalAmount, 0);

  const totalLoyaltyStamps = DEMO_CUSTOMERS.reduce(
    (acc, c) => acc + c.stampsEarned,
    0
  );

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Café Overview Dashboard"
        subtitle="Real-time operations, table occupancy, orders, and sales snapshot"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Simulated Revenue */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Today&apos;s Sales (Simulated)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-900">
              {formatINR(todayRevenue)}
            </span>
            <span className="block text-[11px] text-emerald-600 font-medium mt-0.5">
              &uarr; 14% vs yesterday average
            </span>
          </div>
        </div>

        {/* Card 2: Active Seated Tables */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Table Occupancy
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Grid className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-900">
              {activeTablesCount} / {DEMO_TABLES.length}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              {DEMO_TABLES.length - activeTablesCount} tables available for walk-ins
            </span>
          </div>
        </div>

        {/* Card 3: Pending Kitchen Orders */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Kitchen Tickets
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <ChefHat className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-900">
              {pendingOrders.length} In-Queue
            </span>
            <span className="block text-[11px] text-amber-600 mt-0.5 font-medium">
              Average ticket time: 11 mins
            </span>
          </div>
        </div>

        {/* Card 4: Loyalty Stamps */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Loyalty Stamps
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-zinc-900">
              {totalLoyaltyStamps} Issued
            </span>
            <span className="block text-[11px] text-purple-700 mt-0.5 font-medium">
              2 guests eligible for 6th free coffee
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Tables Matrix (Left) & Recent Orders Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tables Matrix Preview (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Floor Plan &amp; Table Status
              </h3>
              <p className="text-xs text-zinc-500">
                Click any table to simulate customer view or check active ticket
              </p>
            </div>
            <Link
              href="/controlroom/tables"
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>Manage Tables</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DEMO_TABLES.map((t) => {
              const statusColors = {
                available: "bg-emerald-50 text-emerald-700 border-emerald-200",
                occupied: "bg-blue-50 text-blue-700 border-blue-200",
                order_pending: "bg-amber-50 text-amber-700 border-amber-200",
                preparing: "bg-orange-50 text-orange-700 border-orange-200",
                billed: "bg-purple-50 text-purple-700 border-purple-200",
              };

              return (
                <Link
                  key={t.id}
                  href={`/t/${t.code}`}
                  target="_blank"
                  className={`group relative rounded-xl border p-3 transition hover:shadow-md ${statusColors[t.status]}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-serif font-bold text-sm text-zinc-900">
                      T-{t.code}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-zinc-500" />
                  </div>
                  <span className="block text-[11px] font-semibold capitalize truncate">
                    {t.status.replace("_", " ")}
                  </span>
                  <span className="block text-[10px] text-zinc-500 truncate mt-1">
                    {t.currentCustomerName || `${t.capacity} Seats`}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Table Legend */}
          <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center gap-3 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Order Pending
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> In Kitchen
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Ready to Bill
            </span>
          </div>
        </div>

        {/* Live Orders Feed (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Live Orders
              </h3>
              <p className="text-xs text-zinc-500">
                Recent tickets sent by table customers
              </p>
            </div>
            <Link
              href="/controlroom/orders"
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>All Orders</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-100 space-y-2">
            {DEMO_ORDERS.slice(0, 4).map((ord) => (
              <div key={ord.id} className="pt-2 first:pt-0 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900">
                      {ord.orderNumber}
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      Table {ord.tableCode}
                    </span>
                  </div>
                  <span className="font-extrabold text-zinc-900">
                    {formatINR(ord.totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{ord.customerName} &bull; {ord.items.length} items</span>
                  <span className="capitalize font-semibold text-amber-800">
                    {ord.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/controlroom/cashier"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
            >
              <ReceiptText className="h-4 w-4 text-amber-300" />
              <span>Open Cashier Counter POS &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

