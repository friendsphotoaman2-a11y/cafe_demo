"use client";

import React, { useState } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { DEMO_ORDERS, DEMO_SETTINGS } from "@/lib/demo-data";
import { CafeOrder } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  ReceiptText,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Printer,
  Sparkles,
  User,
} from "lucide-react";

export default function ControlRoomCashierPage() {
  const [orders, setOrders] = useState<CafeOrder[]>(DEMO_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    DEMO_ORDERS[0]?.id || ""
  );
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash" | "Card">(
    "UPI"
  );
  const [paidToast, setPaidToast] = useState<string | null>(null);

  const selectedOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0];

  const handleMarkPaid = () => {
    if (!selectedOrder) return;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrder.id
          ? {
              ...o,
              paymentStatus: "paid_counter",
              paymentMethod,
              status: o.status === "served" ? "completed" : o.status,
            }
          : o
      )
    );
    setPaidToast(
      `Payment of ${formatINR(selectedOrder.totalAmount)} confirmed via ${paymentMethod} for Table ${selectedOrder.tableCode}!`
    );
    setTimeout(() => {
      setPaidToast(null);
    }, 4000);
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Counter Cashier &amp; POS Billing"
        subtitle="Settle table tickets, accept UPI/Cash/Card at counter, and print tax receipts"
      />

      {paidToast && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{paidToast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Orders Selector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-900">
              Active Dining Tables
            </h3>
            <span className="text-xs font-semibold text-zinc-500">
              Select to Bill
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {orders.map((ord) => {
              const isSelected = ord.id === selectedOrder?.id;
              const isPaid = ord.paymentStatus === "paid_counter";

              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                      : "border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/80 text-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                          isSelected
                            ? "bg-amber-400 text-zinc-950"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        Table {ord.tableCode}
                      </span>
                      <span className="font-bold text-xs">{ord.orderNumber}</span>
                    </div>
                    <span
                      className={`text-sm font-extrabold ${
                        isSelected ? "text-amber-300" : "text-zinc-900"
                      }`}
                    >
                      {formatINR(ord.totalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] opacity-80">
                    <span>
                      {ord.customerName} &bull; {ord.items.length} items
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isPaid
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Bill & Payment Terminal (7 cols) */}
        {selectedOrder && (
          <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Tax Invoice Preview
                </span>
                <h3 className="font-serif text-2xl font-bold text-zinc-900 mt-0.5">
                  Table {selectedOrder.tableCode} Bill
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedOrder.orderNumber} &bull; Guest: {selectedOrder.customerName} ({selectedOrder.customerPhone})
                </p>
              </div>

              <div className="text-right">
                <span className="block text-2xl font-black text-zinc-900">
                  {formatINR(selectedOrder.totalAmount)}
                </span>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    selectedOrder.paymentStatus === "paid_counter"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedOrder.paymentStatus === "paid_counter"
                    ? "PAID AT COUNTER"
                    : "PAYMENT DUE"}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Ordered Items
              </h4>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {selectedOrder.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-900">
                        {item.quantity} &times; {item.name}
                      </span>
                      {item.customizations.map((c, i) => (
                        <div key={i} className="text-[10px] text-zinc-500 ml-4">
                          &bull; {c.optionName}
                        </div>
                      ))}
                    </div>
                    <span className="font-bold text-zinc-800">
                      {formatINR(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations */}
            <div className="rounded-xl bg-zinc-50 p-4 space-y-2 text-xs text-zinc-600 border border-zinc-200">
              <div className="flex justify-between">
                <span>Subtotal Items</span>
                <span>{formatINR(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Central &amp; State GST (5% Total)</span>
                <span>{formatINR(selectedOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-2 border-t border-zinc-200">
                <span>Total Amount Due</span>
                <span className="text-amber-600">
                  {formatINR(selectedOrder.totalAmount)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            {selectedOrder.paymentStatus !== "paid_counter" ? (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Select Counter Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition ${
                      paymentMethod === "UPI"
                        ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <QrCode className="h-5 w-5 mb-1 text-amber-600" />
                    <span>UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Cash")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition ${
                      paymentMethod === "Cash"
                        ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <Banknote className="h-5 w-5 mb-1 text-emerald-600" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Card")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition ${
                      paymentMethod === "Card"
                        ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mb-1 text-blue-600" />
                    <span>Card / POS</span>
                  </button>
                </div>

                <button
                  onClick={handleMarkPaid}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-98"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-300" />
                  <span>
                    Confirm {paymentMethod} Payment &bull; {formatINR(selectedOrder.totalAmount)}
                  </span>
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-900">
                  Bill Settled via {selectedOrder.paymentMethod || "Counter"}
                </h4>
                <p className="text-xs text-emerald-700">
                  Receipt ready for customer. Table {selectedOrder.tableCode} is ready to be cleared.
                </p>
                <button
                  onClick={() =>
                    alert("Printing simulated thermal tax receipt...")
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition mt-2"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Thermal Receipt</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

