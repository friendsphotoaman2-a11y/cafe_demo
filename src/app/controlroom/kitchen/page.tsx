"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import { CafeOrder, OrderStatus } from "@/lib/types";
import {
  Clock,
  Play,
  Check,
  Volume2,
  VolumeX,
  User,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";

export default function ControlRoomKitchenPage() {
  const { orders: localOrders, updateOrderStatus } = useCafeStore();
  const [serverOrders, setServerOrders] = useState<CafeOrder[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showServedHistory, setShowServedHistory] = useState(false);
  const prevOrderCount = useRef(0);

  // Play synthesized web audio bell on new order arrival
  const playChime = useCallback(() => {
    if (!isAudioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // AudioContext policy: Ignore if user hasn't interacted yet
    }
  }, [isAudioEnabled]);

  // Authoritative server fetch from Supabase
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.orders)) {
          setServerOrders(data.orders);
          if (
            prevOrderCount.current > 0 &&
            data.orders.length > prevOrderCount.current
          ) {
            playChime();
          }
          prevOrderCount.current = data.orders.length;
        }
      }
    } catch {
      // Offline fallback: serverOrders remains empty, falls back to localOrders
    }
  }, [playChime]);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 4000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  // Use authoritative server orders if available, otherwise local store
  const effectiveOrders = serverOrders.length > 0 ? serverOrders : localOrders;

  // Active tickets: MUST NOT be paid at counter and MUST NOT be completed/served/cancelled
  const newTickets = effectiveOrders.filter(
    (o) => o.status === "new" && o.paymentStatus !== "paid_counter"
  );
  const acceptedTickets = effectiveOrders.filter(
    (o) => o.status === "accepted" && o.paymentStatus !== "paid_counter"
  );
  const preparingTickets = effectiveOrders.filter(
    (o) => o.status === "preparing" && o.paymentStatus !== "paid_counter"
  );
  const readyTickets = effectiveOrders.filter(
    (o) => o.status === "ready" && o.paymentStatus !== "paid_counter"
  );

  // Delivered & Settled Tickets
  const servedTickets = effectiveOrders.filter(
    (o) =>
      o.status === "served" ||
      o.status === "completed" ||
      o.paymentStatus === "paid_counter"
  );

  const handleStatusTransition = async (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    // 1. Optimistically update local view
    setServerOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    // 2. Sync client-side store
    await updateOrderStatus(orderId, nextStatus);

    // 3. Persist canonically in Supabase via API
    try {
      await fetch("/api/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, nextStatus }),
      });
    } catch (err) {
      console.warn("Failed to sync order status to server:", err);
    }
  };

  const renderTicketCard = (ord: CafeOrder) => (
    <div
      key={ord.id}
      className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3 transition hover:shadow-md"
    >
      {/* Ticket Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-black text-amber-300">
            Table {ord.tableCode}
          </span>
          <span className="font-bold text-xs text-zinc-900">
            {ord.orderNumber}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
          <Clock className="h-3 w-3 text-amber-600" />
          <span>{ord.createdAt}</span>
        </div>
      </div>

      {/* Guest Name */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span className="flex items-center gap-1 font-semibold text-zinc-800">
          <User className="h-3 w-3 text-zinc-400" />
          {ord.customerName}
        </span>
        <span className="text-[11px] text-zinc-400">{ord.customerPhone}</span>
      </div>

      {/* Items List */}
      <div className="space-y-2 text-xs border-t border-b border-zinc-50 py-2">
        {ord.items.map((item, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="flex items-center justify-between font-bold text-zinc-900">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    item.classification === "veg"
                      ? "bg-emerald-600"
                      : item.classification === "vegan"
                      ? "bg-teal-600"
                      : "bg-red-600"
                  }`}
                />
                <span>
                  {item.quantity} &times; {item.name}
                </span>
              </span>
            </div>
            {item.customizations?.map((c, ci) => (
              <span
                key={ci}
                className="inline-block text-[10px] text-amber-900 bg-amber-50 rounded px-1.5 py-0.5 mr-1 font-medium border border-amber-200/50"
              >
                {c.optionName}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Kitchen Notes */}
      {ord.notes && (
        <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200">
          <span className="font-bold">Instructions: </span>
          {ord.notes}
        </div>
      )}

      {/* Action Workflow Buttons */}
      <div className="pt-2 flex items-center justify-end gap-2">
        {ord.status === "new" && (
          <button
            onClick={() => handleStatusTransition(ord.id, "accepted")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Accept Order</span>
          </button>
        )}

        {ord.status === "accepted" && (
          <button
            onClick={() => handleStatusTransition(ord.id, "preparing")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 transition"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Preparing</span>
          </button>
        )}

        {ord.status === "preparing" && (
          <button
            onClick={() => handleStatusTransition(ord.id, "ready")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            <Check className="h-4 w-4" />
            <span>Mark Ready for Server</span>
          </button>
        )}

        {ord.status === "ready" && (
          <button
            onClick={() => handleStatusTransition(ord.id, "served")}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
          >
            <CheckCheck className="h-4 w-4 text-amber-300" />
            <span>Mark Served at Table</span>
          </button>
        )}

        {(ord.status === "served" || ord.status === "completed") && (
          <span className="w-full text-center text-xs font-bold text-zinc-600 bg-zinc-100 py-1.5 rounded-xl flex items-center justify-center gap-1">
            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Delivered to Guest</span>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Kitchen Display & Barista Expediting (KDS)"
        subtitle="Live ticket kanban: New → Accepted → Preparing → Ready → Served with customer screen sync"
      />

      {/* Audio & Status bar */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold text-zinc-900">
            KDS Connected: Real-time Supabase table tickets active
          </span>
        </div>

        <button
          onClick={() => {
            setIsAudioEnabled(!isAudioEnabled);
            if (!isAudioEnabled) playChime();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
        >
          {isAudioEnabled ? (
            <>
              <Volume2 className="h-4 w-4 text-emerald-600" />
              <span>Chime: Active</span>
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 text-zinc-400" />
              <span>Chime: Muted</span>
            </>
          )}
        </button>
      </div>

      {/* Kanban Board 4 Active Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Column 1: New Tickets */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                1. New Tickets
              </h3>
            </div>
            <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-extrabold text-amber-900">
              {newTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {newTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No new tickets.
              </p>
            ) : (
              newTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 2: Accepted */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                2. Accepted
              </h3>
            </div>
            <span className="rounded-full bg-blue-200/70 px-2 py-0.5 text-xs font-extrabold text-blue-900">
              {acceptedTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {acceptedTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No accepted tickets.
              </p>
            ) : (
              acceptedTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 3: In Preparation */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                3. Cooking / Brewing
              </h3>
            </div>
            <span className="rounded-full bg-orange-200/70 px-2 py-0.5 text-xs font-extrabold text-orange-900">
              {preparingTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {preparingTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No items on burners/bar.
              </p>
            ) : (
              preparingTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 4: Ready to Serve */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                4. Ready to Serve
              </h3>
            </div>
            <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-xs font-extrabold text-emerald-900">
              {readyTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {readyTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                Pass is clear.
              </p>
            ) : (
              readyTickets.map(renderTicketCard)
            )}
          </div>
        </div>
      </div>

      {/* Served & Completed Tickets History (Collapsible) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3">
        <button
          onClick={() => setShowServedHistory((prev) => !prev)}
          className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-700 hover:text-zinc-900 transition"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <span>Delivered & Settled History ({servedTickets.length})</span>
          </div>
          {showServedHistory ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>

        {showServedHistory && (
          <div className="pt-2 border-t border-zinc-100">
            {servedTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">
                No tickets delivered yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {servedTickets.slice(0, 9).map(renderTicketCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
