"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import { formatINR } from "@/lib/utils";
import {
  DollarSign,
  Grid,
  ChefHat,
  Receipt,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  ReceiptText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface DashboardKpis {
  activeTablesCount: number;
  totalTablesCount: number;
  newOrdersCount: number;
  pendingKitchenCount: number;
  outstandingBillsCount: number;
  paidSalesTotal: number;
  paidOrdersCount: number;
}

interface DashboardTable {
  id: string;
  code: string;
  name: string;
  capacity: number;
  section: string;
  status: "available" | "occupied" | "order_pending" | "preparing" | "billed";
  isActive: boolean;
  currentCustomerName?: string;
  currentCustomerPhone?: string;
}

export default function ControlRoomDashboardPage() {
  const { tables: localTables, orders: localOrders, resetDemoData } = useCafeStore();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [dashboardKpis, setDashboardKpis] = useState<DashboardKpis | null>(null);
  const [serverTables, setServerTables] = useState<DashboardTable[] | null>(null);

  // Authoritative server fetch from Supabase
  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch("/api/controlroom/dashboard");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.kpis) {
          setDashboardKpis(data.kpis);
          if (Array.isArray(data.tables)) {
            setServerTables(data.tables);
          }
        }
      }
    } catch {
      // Offline fallback: keep local store calculation
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    const timer = setInterval(fetchDashboardStats, 4000);
    return () => clearInterval(timer);
  }, [fetchDashboardStats]);

  // Fallback calculations from local store if server not ready
  const fallbackActiveTablesCount = localTables.filter(
    (t) => t.status !== "available"
  ).length;

  const fallbackNewOrdersCount = localOrders.filter((o) => o.status === "new").length;

  const fallbackPendingKitchenCount = localOrders.filter(
    (o) => o.status === "new" || o.status === "accepted" || o.status === "preparing"
  ).length;

  const fallbackOutstandingBillsCount = localTables.filter((t) =>
    localOrders.some((o) => o.tableCode === t.code && o.paymentStatus === "unpaid")
  ).length;

  const paidOrders = localOrders.filter((o) => o.paymentStatus === "paid_counter");
  const fallbackPaidSalesTotal = paidOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  // Authoritative metrics prioritize server data
  const activeTablesCount = dashboardKpis !== null ? dashboardKpis.activeTablesCount : fallbackActiveTablesCount;
  const totalTablesCount = dashboardKpis !== null ? dashboardKpis.totalTablesCount : localTables.length;
  const outstandingBillsCount = dashboardKpis !== null ? dashboardKpis.outstandingBillsCount : fallbackOutstandingBillsCount;
  const pendingKitchenCount = dashboardKpis !== null ? dashboardKpis.pendingKitchenCount : fallbackPendingKitchenCount;
  const newOrdersCount = dashboardKpis !== null ? dashboardKpis.newOrdersCount : fallbackNewOrdersCount;
  const paidSalesTotal = dashboardKpis !== null ? dashboardKpis.paidSalesTotal : fallbackPaidSalesTotal;
  const paidCount = dashboardKpis !== null ? dashboardKpis.paidOrdersCount : paidOrders.length;
  const displayTables = serverTables !== null ? serverTables : localTables;

  const handleConfirmReset = () => {
    resetDemoData();
    setIsResetModalOpen(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 4000);
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Café Operations HQ"
        subtitle="Live floor occupancy, connected table tickets, kitchen queues, and counter billing"
      />

      {resetDone && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">
            Floor state reset to clean operational slate! All tables are available.
          </span>
        </div>
      )}

      {/* Top Banner: Live Operations HQ */}
      <div className="rounded-3xl border border-zinc-200 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-serif font-bold text-base text-white">
              Live Cloud Operations HQ
            </h3>
          </div>
          <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
            Connected to Supabase Cloud Database. Table orders placed by customers arrive here in real time. Kitchen updates and cashier settlements sync across all connected devices.
          </p>
        </div>

        <button
          onClick={() => setIsResetModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition shadow-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
          <span>Reset Floor State</span>
        </button>
      </div>

      {/* 4 Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Paid Sales */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Settled Counter Sales
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-900">
              {formatINR(paidSalesTotal)}
            </span>
            <span className="block text-[11px] text-emerald-600 font-medium mt-0.5">
              {paidCount} settled tickets at counter
            </span>
          </div>
        </div>

        {/* KPI 2: Outstanding Counter Bills */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Outstanding Bills
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-900">
              {outstandingBillsCount} Tables
            </span>
            <span className="block text-[11px] text-purple-700 mt-0.5 font-medium">
              Ready for cashier counter settlement
            </span>
          </div>
        </div>

        {/* KPI 3: Pending Kitchen Tickets */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Pending Kitchen Tickets
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <ChefHat className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-900">
              {pendingKitchenCount} In-Queue
            </span>
            <span className="block text-[11px] text-orange-700 mt-0.5 font-medium">
              {newOrdersCount} unaccepted new tickets
            </span>
          </div>
        </div>

        {/* KPI 4: Active Seated Tables */}
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
            <span className="text-2xl font-black text-zinc-900">
              {activeTablesCount} / {totalTablesCount}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              {totalTablesCount - activeTablesCount} available for walk-ins
            </span>
          </div>
        </div>
      </div>

      {/* Main Floor Plan & Live Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Floor Plan Matrix (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Floor Plan &amp; Live Table Status
              </h3>
              <p className="text-xs text-zinc-500">
                Click any table to open its customer ordering screen in a new tab
              </p>
            </div>
            <Link
              href="/controlroom/tables"
              className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
            >
              <span>Manage Tables</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayTables.map((t) => {
              const statusColors = {
                available: "bg-emerald-50 text-emerald-800 border-emerald-200",
                occupied: "bg-blue-50 text-blue-800 border-blue-200",
                order_pending: "bg-amber-50 text-amber-800 border-amber-200",
                preparing: "bg-orange-50 text-orange-800 border-orange-200",
                billed: "bg-purple-50 text-purple-800 border-purple-200",
              };

              return (
                <Link
                  key={t.id}
                  href={`/t/${t.code}`}
                  target="_blank"
                  className={`group relative rounded-xl border p-3 transition hover:shadow-md ${statusColors[t.status] || statusColors.available}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-serif font-bold text-sm text-zinc-900">
                      T-{t.code}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-zinc-500" />
                  </div>
                  <span className="block text-[11px] font-bold capitalize truncate">
                    {t.status.replace("_", " ")}
                  </span>
                  <span className="block text-[10px] text-zinc-600 truncate mt-1">
                    {t.currentCustomerName || `${t.capacity} Seats`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Live Orders Feed (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Connected Order Stream
              </h3>
              <p className="text-xs text-zinc-500">
                Live tickets dispatched from table QR orders
              </p>
            </div>
            <Link
              href="/controlroom/orders"
              className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-100 space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {localOrders.slice(0, 5).map((ord) => (
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
                  <span>
                    {ord.customerName} &bull; {ord.items.length} items
                  </span>
                  <span
                    className={`capitalize font-bold ${
                      ord.paymentStatus === "paid_counter"
                        ? "text-emerald-700"
                        : "text-amber-800"
                    }`}
                  >
                    {ord.status} &bull;{" "}
                    {ord.paymentStatus === "paid_counter" ? "Paid" : "Unpaid"}
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

      {/* Confirmed Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-zinc-900 border-b pb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Confirm Floor State Reset
              </h3>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              This will reset all 12 tables back to clean, available status and clear local floor caches.
              <strong className="block text-zinc-900 mt-2">
                Live Supabase cloud orders and database records will remain secure.
              </strong>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
              >
                Reset Floor Slate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
