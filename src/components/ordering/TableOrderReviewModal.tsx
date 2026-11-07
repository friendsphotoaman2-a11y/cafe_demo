"use client";

import React, { useState } from "react";
import { CartItem, CafeOrder, TableSessionBill } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  CheckCircle,
  Receipt,
  User,
  Phone,
  Clock,
  X,
  AlertCircle,
  ArrowRight,
  Coffee,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface TableOrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableCode: string;
  customerName: string;
  customerPhone: string;
  cartItems: CartItem[];
  previousOrders?: CafeOrder[];
  currentSessionBill?: TableSessionBill | null;
  kitchenNotes?: string;
  onConfirmOrder: (notes?: string) => Promise<{
    order: CafeOrder;
    sessionBill: TableSessionBill | null;
    diningSessionToken?: string;
  }>;
  onOrderSuccess: (orderNumber: string) => void;
  onEditCustomer: () => void;
  onViewOrders?: () => void;
  onViewBill?: () => void;
}

export default function TableOrderReviewModal({
  isOpen,
  onClose,
  tableCode,
  customerName,
  customerPhone,
  cartItems,
  previousOrders = [],
  currentSessionBill,
  kitchenNotes,
  onConfirmOrder,
  onOrderSuccess,
  onEditCustomer,
  onViewOrders,
  onViewBill,
}: TableOrderReviewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative confirmed order snapshot - frozen upon server success so it NEVER turns to ₹0
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<{
    orderNumber: string;
    orderTotal: number;
    orderSubtotal: number;
    orderTax: number;
    runningBillTotal: number;
    customerName: string;
    roundNumber: number;
  } | null>(null);

  if (!isOpen) return null;

  // New items calculation (current round)
  const newSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const newTax = Math.round(newSubtotal * 0.05 * 100) / 100;
  const newRoundTotal = newSubtotal + newTax;

  // Cumulative session calculation
  const previousSubtotal = previousOrders.reduce((acc, o) => acc + o.subtotal, 0);
  const combinedSubtotal = previousSubtotal + newSubtotal;
  const combinedTax = Math.round(combinedSubtotal * 0.05 * 100) / 100;
  const combinedGrandTotal = Math.round((combinedSubtotal + combinedTax) * 100) / 100;

  const currentRound = previousOrders.length + 1;

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Authoritative server submission (never simulated with fake setTimeout)
      const result = await onConfirmOrder(kitchenNotes);

      const authoritativeOrderTotal = result.order?.totalAmount || newRoundTotal;
      const authoritativeRunningTotal =
        result.sessionBill?.totalAmount ||
        (authoritativeOrderTotal + (currentSessionBill?.totalAmount || 0));

      // 1. Freeze snapshot in local modal state BEFORE clearing parent cart items
      setConfirmedSnapshot({
        orderNumber: result.order.orderNumber,
        orderTotal: authoritativeOrderTotal,
        orderSubtotal: result.order.subtotal || newSubtotal,
        orderTax: result.order.taxAmount || newTax,
        runningBillTotal: authoritativeRunningTotal,
        customerName: customerName || "Guest",
        roundNumber: currentRound,
      });

      // 2. Notify parent to clear new cart and update session
      onOrderSuccess(result.order.orderNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setConfirmedSnapshot(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-cafe-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cafe-200 bg-cafe-950 p-5 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-300" />
            <h3 className="font-serif text-lg font-bold">
              {confirmedSnapshot
                ? "Order Confirmed!"
                : previousOrders.length > 0
                ? `Review Round ${currentRound} Order`
                : "Review Table Order"}
            </h3>
          </div>
          <button
            onClick={handleCloseModal}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmedSnapshot ? (
          /* ============================================================== */
          /* AUTHORITATIVE ORDER CONFIRMATION VIEW (Never displays ₹0)      */
          /* ============================================================== */
          <div className="p-6 sm:p-8 text-center space-y-5 animate-fade-in overflow-y-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 mb-2 border border-amber-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                <span>
                  Table {tableCode} &bull; Round {confirmedSnapshot.roundNumber} &bull; {confirmedSnapshot.orderNumber}
                </span>
              </div>
              <h4 className="font-serif text-2xl font-bold text-cafe-950">
                Your Order is Received!
              </h4>
              <p className="mt-1 text-xs text-zinc-600 max-w-xs mx-auto">
                Thank you, <strong className="text-zinc-900">{confirmedSnapshot.customerName}</strong>. Our kitchen is preparing your selections now.
              </p>
            </div>

            {/* Authoritative Status Card */}
            <div className="rounded-2xl border border-cafe-200 bg-cafe-50/70 p-4 text-left space-y-2.5 text-xs text-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Kitchen Status:</span>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-bold text-amber-800 border border-amber-300">
                  Kitchen In-Queue
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Estimated Prep Time:</span>
                <span className="font-semibold text-zinc-900 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  10 &ndash; 15 mins
                </span>
              </div>

              {/* Exact Round Total - ALWAYS POSITIVE, NEVER ₹0 */}
              <div className="flex items-center justify-between border-t border-cafe-200/80 pt-2">
                <span className="font-medium text-zinc-700">
                  This Round ({confirmedSnapshot.orderNumber}):
                </span>
                <span className="font-extrabold text-sm text-zinc-950">
                  {formatINR(confirmedSnapshot.orderTotal)}
                </span>
              </div>

              {/* Exact Consolidated Table Running Total */}
              <div className="flex items-center justify-between bg-amber-100/60 rounded-xl p-2.5 border border-amber-300">
                <div>
                  <span className="block font-bold text-amber-950 text-xs">
                    Running Table Bill:
                  </span>
                  <span className="text-[10px] text-amber-800">
                    Pay at Counter after dining
                  </span>
                </div>
                <span className="font-serif text-base font-black text-cafe-950">
                  {formatINR(confirmedSnapshot.runningBillTotal)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-3 text-[11px] text-emerald-900 text-left flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Persistent Table Session:</strong> Your table session remains active. You can browse the menu anytime and order additional rounds.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleCloseModal}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-xs font-bold text-white hover:bg-cafe-800 transition"
              >
                <Coffee className="h-4 w-4 text-amber-300" />
                <span>Order More Items</span>
              </button>

              <button
                onClick={() => {
                  handleCloseModal();
                  if (onViewOrders) onViewOrders();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-zinc-300 py-3 text-xs font-bold text-zinc-800 hover:bg-zinc-50 transition"
              >
                <Receipt className="h-4 w-4 text-cafe-700" />
                <span>View Full Bill</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* ORDER REVIEW VIEW (Before Confirmation)                        */
          /* ============================================================== */
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Customer Details Pill */}
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-bold text-zinc-900">
                  <User className="h-3.5 w-3.5 text-cafe-600" />
                  <span>{customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{customerPhone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onEditCustomer}
                className="text-xs font-semibold text-cafe-700 hover:text-cafe-950 underline"
              >
                Edit
              </button>
            </div>

            {/* Notice if this is an additional round */}
            {previousOrders.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Adding Round {currentRound} to Table {tableCode}:</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Your previous {previousOrders.length} {previousOrders.length === 1 ? "order is" : "orders are"} already being prepared in the kitchen. This new order will be added to your running table bill.
                  </p>
                </div>
              </div>
            )}

            {/* Items Summary (Current Round Only) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                New Items in Round {currentRound} ({cartItems.length})
              </h4>
              <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                {cartItems.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="flex items-start justify-between p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900">
                        {item.quantity} &times; {item.menuItem.name}
                      </div>
                      {item.selectedCustomizations.map((c, i) => (
                        <div key={i} className="text-[11px] text-zinc-500">
                          &bull; {c.optionName} {c.priceDelta > 0 && `(+₹${c.priceDelta})`}
                        </div>
                      ))}
                    </div>
                    <span className="font-extrabold text-cafe-900">
                      {formatINR(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kitchen Notes */}
            {kitchenNotes && (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-700">
                <span className="font-bold">Instructions for kitchen: </span>
                {kitchenNotes}
              </div>
            )}

            {/* Detailed Bill Breakdown */}
            <div className="rounded-2xl bg-zinc-50 p-4 space-y-2 text-xs text-zinc-600 border border-zinc-200">
              {previousOrders.length > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Previous Orders Subtotal</span>
                  <span>{formatINR(previousSubtotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-zinc-800">
                <span>New Items Subtotal (Round {currentRound})</span>
                <span>{formatINR(newSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Estimated GST (5%)</span>
                <span>{formatINR(previousOrders.length > 0 ? combinedTax : newTax)}</span>
              </div>

              {previousOrders.length > 0 ? (
                <div className="border-t border-zinc-200 pt-2 space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span>This Round Total:</span>
                    <span>{formatINR(newRoundTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-zinc-950 pt-1">
                    <span>Projected Combined Bill:</span>
                    <span className="text-cafe-900 font-serif text-base">{formatINR(combinedGrandTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Grand Total</span>
                  <span className="text-cafe-900">{formatINR(newRoundTotal)}</span>
                </div>
              )}

              <p className="text-[10px] text-zinc-400 pt-1">
                Settled in person at café counter upon dining completion.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting || cartItems.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-cafe-800 disabled:opacity-50 transition active:scale-95"
            >
              {isSubmitting ? (
                <span>Dispatching Order to Barista...</span>
              ) : (
                <>
                  <span>
                    Confirm &amp; Place Round {currentRound} &bull; {formatINR(newRoundTotal)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-amber-300" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
