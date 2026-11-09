"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { CafeOrder, OrderStatus } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { apiUrl } from "@/lib/base-path";
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
  RotateCcw,
  AlertCircle,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function ControlRoomKitchenPage() {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showServedHistory, setShowServedHistory] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<CafeOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const prevOrderCount = useRef(0);

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    setErrorBanner(null);

    try {
      const res = await fetch(apiUrl(`/api/orders?orderId=${encodeURIComponent(orderToDelete.id)}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || "Failed to delete order from database.");
      } else {
        setOrderToDelete(null);
        await fetchOrders();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorBanner(`Failed to delete order: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Authoritative server fetch directly from Supabase via /api/orders
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/orders"));
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
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
      // Network hiccup - keep current orders
    } finally {
      setIsLoading(false);
    }
  }, [playChime]);

  // Polling every 4 seconds to maintain fresh state across all tabs
  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 4000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  // Concurrency-Safe Sequential Status Transition Handler
  const handleStatusTransition = async (
    orderId: string,
    nextStatus: OrderStatus,
    currentStatus: OrderStatus
  ) => {
    setTransitioningId(orderId);
    setErrorBanner(null);

    // 1. Safe Optimistic UI Update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    try {
      // 2. Server Validation with Expected Previous Status Guard
      const res = await fetch(apiUrl("/api/orders/status"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          nextStatus,
          expectedPreviousStatus: currentStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg =
          data.error || "Status update was rejected by the server.";
        setErrorBanner(errMsg);
        // Rollback to authoritative server state immediately
        await fetchOrders();
        return;
      }

      // 3. Confirm with authoritative state from server
      await fetchOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorBanner(`Failed to update order: ${msg}`);
      await fetchOrders();
    } finally {
      setTransitioningId(null);
    }
  };

  // Active tickets: MUST NOT be paid at counter and MUST NOT be completed/served/cancelled
  const newTickets = orders.filter(
    (o) => o.status === "new" && o.paymentStatus !== "paid_counter"
  );
  const acceptedTickets = orders.filter(
    (o) => o.status === "accepted" && o.paymentStatus !== "paid_counter"
  );
  const preparingTickets = orders.filter(
    (o) => o.status === "preparing" && o.paymentStatus !== "paid_counter"
  );
  const readyTickets = orders.filter(
    (o) => o.status === "ready" && o.paymentStatus !== "paid_counter"
  );

  // Delivered & Settled Tickets History
  const servedTickets = orders.filter(
    (o) =>
      o.status === "served" ||
      o.status === "completed" ||
      o.paymentStatus === "paid_counter"
  );

  const renderTicketCard = (ord: CafeOrder) => {
    const isUpdating = transitioningId === ord.id;

    return (
      <div
        key={ord.id}
        className={`flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs space-y-3 transition hover:shadow-md ${
          isUpdating ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {/* Ticket Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg bg-zinc-950 px-2 py-0.5 text-xs font-black text-amber-300">
              Table {ord.tableCode}
            </span>
            <span className="font-bold text-xs text-zinc-900">
              {ord.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
              <Clock className="h-3 w-3 text-amber-600" />
              <span>{ord.createdAt}</span>
            </div>
            <button
              onClick={() => setOrderToDelete(ord)}
              className="p-1 rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 transition"
              title="Delete mistake ticket from DB"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Guest Name & Items Count */}
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span className="flex items-center gap-1 font-bold text-zinc-900 truncate">
            <User className="h-3 w-3 text-zinc-400 shrink-0" />
            <span className="truncate">{ord.customerName}</span>
          </span>
          <span className="text-[11px] font-extrabold text-zinc-900 shrink-0">
            {formatINR(ord.totalAmount)}
          </span>
        </div>

        {/* Itemized Order List */}
        <div className="space-y-1.5 text-xs border-t border-b border-zinc-50 py-2">
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
                  className="inline-block text-[10px] text-amber-900 bg-amber-50 rounded px-1.5 py-0.2 mr-1 font-medium border border-amber-200/60"
                >
                  {c.optionName}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Kitchen Notes */}
        {ord.notes && (
          <div className="rounded-xl bg-amber-50/80 p-2 text-[11px] text-amber-950 border border-amber-200/60">
            <span className="font-bold">Instructions: </span>
            {ord.notes}
          </div>
        )}

        {/* Sequential Manual Action Button */}
        <div className="pt-1 flex items-center justify-end">
          {ord.status === "new" && (
            <button
              onClick={() =>
                handleStatusTransition(ord.id, "accepted", "new")
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-98 transition shadow-xs"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept Order</span>
            </button>
          )}

          {ord.status === "accepted" && (
            <button
              onClick={() =>
                handleStatusTransition(ord.id, "preparing", "accepted")
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 active:scale-98 transition shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Brewing / Cooking</span>
            </button>
          )}

          {ord.status === "preparing" && (
            <button
              onClick={() =>
                handleStatusTransition(ord.id, "ready", "preparing")
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-98 transition shadow-xs"
            >
              <Check className="h-4 w-4" />
              <span>Mark Ready for Server</span>
            </button>
          )}

          {ord.status === "ready" && (
            <button
              onClick={() =>
                handleStatusTransition(ord.id, "served", "ready")
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 active:scale-98 transition shadow-xs"
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
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <ControlRoomHeader
        title="Kitchen Display & Barista Expediting (KDS)"
        subtitle="Canonical manual ticket workflow: New → Accepted → Preparing → Ready → Served"
      />

      {/* Error / Conflict Alert */}
      {errorBanner && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs font-bold text-red-900 flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-700 hover:text-red-900 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status & Expedite Control Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-900">
            Canonical Supabase Ticket Stream Active
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">
            &bull; Manual state progression &bull; Zero auto-advancement
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
            title="Force refresh tickets"
          >
            <RotateCcw className="h-3 w-3 text-zinc-500" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => {
              setIsAudioEnabled(!isAudioEnabled);
              if (!isAudioEnabled) playChime();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
          >
            {isAudioEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Chime: Active</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Chime: Muted</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Kanban Board 4 Active Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Column 1: New Tickets */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                1. New Tickets
              </h3>
            </div>
            <span className="rounded-full bg-amber-200/80 px-2 py-0.2 text-xs font-black text-amber-950">
              {newTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-zinc-400">Loading...</div>
            ) : newTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No new tickets.
              </p>
            ) : (
              newTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 2: Accepted */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                2. Accepted
              </h3>
            </div>
            <span className="rounded-full bg-blue-200/80 px-2 py-0.2 text-xs font-black text-blue-950">
              {acceptedTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {acceptedTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                No tickets accepted.
              </p>
            ) : (
              acceptedTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 3: In Preparation */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                3. Brewing / Cooking
              </h3>
            </div>
            <span className="rounded-full bg-orange-200/80 px-2 py-0.2 text-xs font-black text-orange-950">
              {preparingTickets.length}
            </span>
          </div>

          <div className="space-y-3">
            {preparingTickets.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">
                Pass is clear.
              </p>
            ) : (
              preparingTickets.map(renderTicketCard)
            )}
          </div>
        </div>

        {/* Column 4: Ready to Serve */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="font-serif font-bold text-sm text-zinc-900">
                4. Ready to Serve
              </h3>
            </div>
            <span className="rounded-full bg-emerald-200/80 px-2 py-0.2 text-xs font-black text-emerald-950">
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

      {/* Delivered & Completed Tickets History (Collapsible) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3">
        <button
          onClick={() => setShowServedHistory((prev) => !prev)}
          className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-700 hover:text-zinc-900 transition"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <span>Delivered &amp; Settled History ({servedTickets.length})</span>
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

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-red-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-zinc-900 leading-tight">
                  Delete Ticket #{orderToDelete.orderNumber}?
                </h3>
                <span className="text-xs text-zinc-500 font-medium">
                  Table {orderToDelete.tableCode} &bull; {orderToDelete.customerName}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3.5 text-xs text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Remove Mistake Order</span>
              </div>
              <p className="leading-relaxed">
                This ticket will be <strong>permanently deleted from Supabase cloud database</strong> and removed from all kitchen columns.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete from DB</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
