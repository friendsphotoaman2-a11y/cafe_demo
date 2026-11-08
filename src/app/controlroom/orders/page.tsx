"use client";

import React, { useState } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { CafeOrder, OrderStatus } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Eye, X, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function ControlRoomOrdersPage() {
  const { orders, deleteOrder } = useCafeStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<CafeOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<CafeOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });

  const handleDeleteConfirmed = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    setActionBanner(null);

    const res = await deleteOrder(orderToDelete.id);
    setIsDeleting(false);

    if (res.success) {
      setActionBanner({
        type: "success",
        message: `Order #${orderToDelete.orderNumber} (Table ${orderToDelete.tableCode}) was permanently deleted from the database and floor queue.`,
      });
      setOrderToDelete(null);
      if (selectedOrder?.id === orderToDelete.id) {
        setSelectedOrder(null);
      }
      setTimeout(() => setActionBanner(null), 6000);
    } else {
      setActionBanner({
        type: "error",
        message: res.error || "Failed to delete order from database.",
      });
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "new":
        return (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
            1. New Ticket
          </span>
        );
      case "accepted":
        return (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-300">
            2. Accepted
          </span>
        );
      case "preparing":
        return (
          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-900 border border-orange-300">
            3. In Kitchen
          </span>
        );
      case "ready":
        return (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 border border-emerald-300">
            4. Ready to Serve
          </span>
        );
      case "served":
        return (
          <span className="rounded-full bg-zinc-800 text-white px-2.5 py-0.5 text-[11px] font-bold">
            5. Served
          </span>
        );
      case "completed":
        return (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-800">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Live Orders Hub"
        subtitle="Active table tickets, order states, itemized customizations, and settlement status"
      />

      {/* Action Notification Banner */}
      {actionBanner && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-semibold shadow-xs animate-fade-in ${
            actionBanner.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
              : "bg-red-50 text-red-900 border border-red-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionBanner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{actionBanner.message}</span>
          </div>
          <button
            onClick={() => setActionBanner(null)}
            className="text-zinc-400 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "All Orders" },
            { id: "new", label: "New Tickets" },
            { id: "accepted", label: "Accepted" },
            { id: "preparing", label: "In Kitchen" },
            { id: "ready", label: "Ready to Serve" },
            { id: "served", label: "Served at Table" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Table</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items Summary</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Order Status</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 text-xs">
                    No active orders at this time. Live orders will appear here automatically when placed from any table QR code.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-zinc-50/60 transition">
                  {/* Order Number */}
                  <td className="py-3.5 px-4 font-bold text-zinc-900">
                    {ord.orderNumber}
                    <span className="block text-[10px] text-zinc-400 font-normal">
                      {ord.createdAt}
                    </span>
                  </td>

                  {/* Table Code */}
                  <td className="py-3.5 px-4">
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900 text-[11px]">
                      Table {ord.tableCode}
                    </span>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-zinc-900 block">
                      {ord.customerName}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {ord.customerPhone}
                    </span>
                  </td>

                  {/* Items */}
                  <td className="py-3.5 px-4 text-zinc-700">
                    <span className="font-medium">
                      {ord.items.length} {ord.items.length === 1 ? "item" : "items"}
                    </span>
                    <span className="block text-[10px] text-zinc-500 truncate max-w-xs">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="py-3.5 px-4 font-extrabold text-zinc-900">
                    {formatINR(ord.totalAmount)}
                  </td>

                  {/* Order Status */}
                  <td className="py-3.5 px-4">{getStatusBadge(ord.status)}</td>

                  {/* Payment Status */}
                  <td className="py-3.5 px-4">
                    {ord.paymentStatus === "paid_counter" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                        Paid ({ord.paymentMethod || "Counter"})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                        Pay at Counter
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                        title="View ticket details"
                      >
                        <Eye className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => setOrderToDelete(ord)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition active:scale-95"
                        title="Permanently delete mistake order"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Order Ticket Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  Table {selectedOrder.tableCode}
                </span>
                <h3 className="font-serif text-lg font-bold text-zinc-900 mt-1">
                  Ticket {selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-zinc-400 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Guest details */}
            <div className="rounded-xl bg-zinc-50 p-3 text-xs space-y-1 text-zinc-700 border border-zinc-200">
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer:</span>
                <span className="font-bold">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Phone:</span>
                <span>{selectedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Created:</span>
                <span>{selectedOrder.createdAt}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-zinc-500 uppercase">
                Itemized Selections
              </h4>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 p-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2 first:pt-1 text-xs">
                    <div className="flex justify-between font-bold text-zinc-900">
                      <span>
                        {item.quantity} &times; {item.name}
                      </span>
                      <span>{formatINR(item.totalPrice)}</span>
                    </div>
                    {item.customizations.map((c, ci) => (
                      <div key={ci} className="text-[11px] text-zinc-500 ml-4">
                        &bull; {c.optionName}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes if any */}
            {selectedOrder.notes && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
                <span className="font-bold">Guest Note: </span>
                {selectedOrder.notes}
              </div>
            )}

            {/* Financials */}
            <div className="rounded-xl bg-zinc-50 p-3 text-xs space-y-1 text-zinc-600 border border-zinc-200">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatINR(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({DEMO_SETTINGS.gstRatePercent}%):</span>
                <span>{formatINR(selectedOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-zinc-900 pt-1 border-t">
                <span>Total Due:</span>
                <span>{formatINR(selectedOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <button
                onClick={() => {
                  const ord = selectedOrder;
                  setSelectedOrder(null);
                  setOrderToDelete(ord);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition active:scale-95"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
                <span>Delete Order from DB</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
              >
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Permanent Delete Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-red-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-zinc-900 leading-tight">
                  Delete Order #{orderToDelete.orderNumber}?
                </h3>
                <span className="text-xs text-zinc-500 font-medium">
                  Table {orderToDelete.tableCode} &bull; {orderToDelete.customerName}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3.5 text-xs text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Permanent Database &amp; Floor Removal</span>
              </div>
              <p className="leading-relaxed">
                This order was placed by mistake. It will be <strong>permanently deleted from Supabase cloud database</strong>, kitchen ticket queue, and counter billing.
              </p>
              <p className="text-[11px] text-red-800/80">
                &bull; Table {orderToDelete.tableCode} status will automatically revert to Available if no other active orders remain.
              </p>
            </div>

            {/* Quick summary */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 space-y-1">
              <div className="flex justify-between font-bold text-zinc-900">
                <span>Items to Remove:</span>
                <span>{orderToDelete.items.length} item(s)</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-900">
                <span>Total Amount:</span>
                <span>{formatINR(orderToDelete.totalAmount)}</span>
              </div>
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
                onClick={handleDeleteConfirmed}
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
                    <span>Confirm Delete from DB</span>
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
