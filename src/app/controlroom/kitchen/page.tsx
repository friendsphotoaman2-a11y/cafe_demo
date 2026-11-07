"use client";

import React, { useState } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { DEMO_ORDERS } from "@/lib/demo-data";
import { CafeOrder, OrderStatus } from "@/lib/types";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  Volume2,
  Flame,
} from "lucide-react";

export default function ControlRoomKitchenPage() {
  const [orders, setOrders] = useState<CafeOrder[]>(DEMO_ORDERS);

  const moveOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, status: nextStatus } : ord
      )
    );
  };

  const pendingTickets = orders.filter((o) => o.status === "pending");
  const preparingTickets = orders.filter((o) => o.status === "preparing");
  const readyTickets = orders.filter((o) => o.status === "ready");

  const renderTicketCard = (ord: CafeOrder) => (
    <div
      key={ord.id}
      className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3"
    >
      {/* Ticket Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-black text-amber-300">
            Table {ord.tableCode}
          </span>
          <span className="font-bold text-xs text-zinc-800">
            {ord.orderNumber}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
          <Clock className="h-3 w-3 text-amber-600" />
          <span>{ord.createdAt}</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2 text-xs">
        {ord.items.map((item, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="flex items-center justify-between font-bold text-zinc-900">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>{item.quantity} &times; {item.name}</span>
              </span>
            </div>
            {item.customizations.map((c, ci) => (
              <span
                key={ci}
                className="inline-block text-[10px] text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 mr-1 font-medium"
              >
                {c.optionName}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Guest Note */}
      {ord.notes && (
        <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200">
          <span className="font-bold">Chef Note: </span>
          {ord.notes}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
        {ord.status === "pending" && (
          <button
            onClick={() => moveOrderStatus(ord.id, "preparing")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 transition"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Brewing / Prep</span>
          </button>
        )}

        {ord.status === "preparing" && (
          <button
            onClick={() => moveOrderStatus(ord.id, "ready")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            <Check className="h-4 w-4" />
            <span>Mark Ready for Server</span>
          </button>
        )}

        {ord.status === "ready" && (
          <span className="w-full text-center text-xs font-bold text-emerald-700 bg-emerald-50 py-1.5 rounded-xl border border-emerald-200">
            &check; Ready at Counter
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Kitchen &amp; Barista Display (KDS)"
        subtitle="Kanban workflow for food expediting, barista pour-overs, and table dispatch"
      />

      {/* Audio & Status pill */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold text-zinc-900">
            Kitchen Audio Chime: Active
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Volume2 className="h-4 w-4 text-zinc-400" />
          <span>Real-time table orders update automatically</span>
        </div>
      </div>

      {/* Kanban Board 3 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: New Pending */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                New Tickets
              </h3>
            </div>
            <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-extrabold text-amber-900">
              {pendingTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {pendingTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No pending tickets.
              </p>
            ) : (
              pendingTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                In Preparation
              </h3>
            </div>
            <span className="rounded-full bg-orange-200/70 px-2 py-0.5 text-xs font-extrabold text-orange-900">
              {preparingTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {preparingTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No orders cooking right now.
              </p>
            ) : (
              preparingTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 3: Ready to Expedite */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                Ready to Serve
              </h3>
            </div>
            <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-xs font-extrabold text-emerald-900">
              {readyTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {readyTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No orders waiting on pass.
              </p>
            ) : (
              readyTickets.map(renderTicketCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

