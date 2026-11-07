"use client";

import React, { useState } from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import { useCafeStore } from "@/lib/store";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { PaymentMethod, TableSessionBill } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  ReceiptText,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Printer,
  Search,
  User,
  Phone,
  RotateCcw,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

export default function ControlRoomCashierPage() {
  const {
    tables,
    orders,
    getTableSessionBill,
    settleTableBill,
    voidPaymentCorrection,
  } = useCafeStore();

  const [selectedTableCode, setSelectedTableCode] = useState<string>("01");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [cashierName, setCashierName] = useState<string>("Rahul (Counter 1)");
  const [search, setSearch] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  // Get active tables with unpaid orders
  const activeUnpaidTables = tables.filter((t) => {
    const hasUnpaid = orders.some(
      (o) => o.tableCode === t.code && o.paymentStatus === "unpaid"
    );
    return hasUnpaid;
  });

  const filteredTables = tables.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const tableMatch = t.code.includes(q) || t.name.toLowerCase().includes(q);
    const guestMatch = t.currentCustomerName?.toLowerCase().includes(q);
    return tableMatch || guestMatch;
  });

  const selectedBill: TableSessionBill | null = getTableSessionBill(selectedTableCode);

  const handleConfirmPayment = async () => {
    if (!selectedBill || selectedBill.isPaid) return;

    const res = await settleTableBill({
      tableCode: selectedBill.tableCode,
      paymentMethod,
      transactionRef: transactionRef.trim() || undefined,
      cashierName: cashierName.trim() || "Head Cashier",
      amountPaid: selectedBill.totalAmount,
    });

    if (res.success) {
      setNotification(
        `Table ${selectedBill.tableCode} bill of ${formatINR(
          selectedBill.totalAmount
        )} settled via ${paymentMethod} by ${cashierName}!`
      );
      setTransactionRef("");
      setTimeout(() => setNotification(null), 5000);
    } else {
      setNotification(`Settlement failed: ${res.error || "Permission denied."}`);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleVoidPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || selectedBill.orderIds.length === 0) return;
    if (!voidReason.trim()) return;

    // Void the first order of the bill for demonstration audit
    voidPaymentCorrection(selectedBill.orderIds[0], voidReason.trim());
    setIsVoidModalOpen(false);
    setVoidReason("");
    setNotification(
      `Payment voided/corrected for Table ${selectedBill.tableCode}. Reason recorded: "${voidReason.trim()}".`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Counter Cashier &amp; POS Settlement"
        subtitle="Consolidated table billing, payment method confirmation (UPI/Cash/Card), and audit trail"
      />

      {notification && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{notification}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tables with Open Bills (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Dining Tables
              </h3>
              <p className="text-xs text-zinc-500">
                {activeUnpaidTables.length} tables with outstanding bills
              </p>
            </div>

            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              {activeUnpaidTables.length} Open
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Table # or customer..."
              className="w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-xs focus:border-zinc-800 focus:outline-none"
            />
          </div>

          {/* Table List */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredTables.map((t) => {
              const isSelected = t.code === selectedTableCode;
              const hasUnpaid = orders.some(
                (o) => o.tableCode === t.code && o.paymentStatus === "unpaid"
              );
              const bill = getTableSessionBill(t.code);

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTableCode(t.code)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                      : "border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-black ${
                          isSelected
                            ? "bg-amber-400 text-zinc-950"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        Table {t.code}
                      </span>
                      <span className="font-bold text-xs truncate max-w-[120px]">
                        {t.currentCustomerName || t.section}
                      </span>
                    </div>

                    <span
                      className={`text-sm font-extrabold ${
                        isSelected ? "text-amber-300" : "text-zinc-900"
                      }`}
                    >
                      {bill ? formatINR(bill.totalAmount) : "₹0"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] opacity-80">
                    <span>
                      {bill?.orderNumbers.length || 0}{" "}
                      {bill?.orderNumbers.length === 1 ? "round" : "rounds"} &bull;{" "}
                      {bill?.consolidatedItems.length || 0} items
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        hasUnpaid
                          ? isSelected
                            ? "bg-amber-400/20 text-amber-300"
                            : "bg-amber-500/10 text-amber-800"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {hasUnpaid ? "Payment Due" : "Settled / Clear"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Consolidated Bill & Counter Terminal (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
          {selectedBill && selectedBill.consolidatedItems.length > 0 ? (
            <>
              {/* Invoice Header */}
              <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Consolidated Table Invoice
                    </span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      Orders: {selectedBill.orderNumbers.join(", ")}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-zinc-900 mt-1">
                    Table {selectedBill.tableCode} Bill
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Guest: <strong>{selectedBill.customerName}</strong>{" "}
                    {selectedBill.customerPhone && `(${selectedBill.customerPhone})`}
                  </p>
                </div>

                <div className="text-right">
                  <span className="block text-2xl font-black text-zinc-900">
                    {formatINR(selectedBill.totalAmount)}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      selectedBill.isPaid
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedBill.isPaid
                      ? `PAID VIA ${selectedBill.paymentMethod || "COUNTER"}`
                      : "OUTSTANDING"}
                  </span>
                </div>
              </div>

              {/* Itemized Table (combining all orders without duplicates) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Ordered Items ({selectedBill.consolidatedItems.length})
                </h4>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                  {selectedBill.consolidatedItems.map((item) => (
                    <div
                      key={item.key}
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

              {/* Calculation Summary */}
              <div className="rounded-2xl bg-zinc-50 p-4 space-y-2 text-xs text-zinc-600 border border-zinc-200">
                <div className="flex justify-between">
                  <span>Subtotal Items</span>
                  <span>{formatINR(selectedBill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    Configured GST ({selectedBill.taxPercent}%) &bull;{" "}
                    <span className="text-[10px] text-zinc-400">Demo setting</span>
                  </span>
                  <span>{formatINR(selectedBill.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Total Amount Payable</span>
                  <span className="text-amber-600">
                    {formatINR(selectedBill.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Terminal Form */}
              {!selectedBill.isPaid ? (
                <div className="space-y-4 pt-2">
                  {/* Staff Display Name for Audit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-zinc-700 block mb-1">
                        Cashier Staff Name (Audit Log)
                      </label>
                      <input
                        type="text"
                        value={cashierName}
                        onChange={(e) => setCashierName(e.target.value)}
                        placeholder="e.g. Rahul (Counter 1)"
                        className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-zinc-700 block mb-1">
                        Transaction Ref / Last 4 (Optional)
                      </label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="e.g. UPI-984210"
                        className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "UPI", label: "UPI QR", icon: QrCode },
                        { id: "Cash", label: "Cash", icon: Banknote },
                        { id: "Card", label: "Card", icon: CreditCard },
                        { id: "Other", label: "Other", icon: ReceiptText },
                      ].map((m) => {
                        const Icon = m.icon;
                        const isSelected = paymentMethod === m.id;

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                            className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-bold transition ${
                              isSelected
                                ? "border-amber-500 bg-amber-50 text-amber-950 shadow-xs ring-1 ring-amber-500"
                                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            <Icon className="h-4 w-4 mb-1 text-amber-600" />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    onClick={handleConfirmPayment}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-98"
                  >
                    <CheckCircle2 className="h-4 w-4 text-amber-300" />
                    <span>
                      Confirm {paymentMethod} Payment &bull;{" "}
                      {formatINR(selectedBill.totalAmount)}
                    </span>
                  </button>
                </div>
              ) : (
                /* Settled Receipt Card */
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-3">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600 mx-auto" />
                  <div>
                    <h4 className="font-serif text-lg font-bold text-emerald-950">
                      Bill Confirmed &amp; Paid
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Settled via <strong>{selectedBill.paymentMethod}</strong>{" "}
                      by {selectedBill.paymentAudit?.cashierName || cashierName} at{" "}
                      {selectedBill.paymentAudit?.paidAt || "Counter"}.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print Thermal Receipt</span>
                    </button>

                    <button
                      onClick={() => setIsVoidModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Demo Void / Correction</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-zinc-400 space-y-2">
              <ReceiptText className="h-10 w-10 mx-auto text-zinc-300" />
              <h4 className="font-serif text-base font-bold text-zinc-800">
                No orders for Table {selectedTableCode}
              </h4>
              <p className="text-xs text-zinc-400">
                Select an active table on the left or place a new order at{" "}
                <Link
                  href={`/t/${selectedTableCode}`}
                  target="_blank"
                  className="text-amber-700 underline font-semibold"
                >
                  /t/{selectedTableCode}
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controlled Void Payment Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Controlled Payment Correction
              </h3>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Voiding a payment marks the table orders as unpaid again for dispute handling or payment retry.
            </p>

            <form onSubmit={handleVoidPayment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  Reason for Correction *
                </label>
                <input
                  type="text"
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Guest switched payment from Cash to UPI QR"
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
