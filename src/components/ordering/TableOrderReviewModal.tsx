"use client";

import React, { useState } from "react";
import { CartItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  CheckCircle,
  Receipt,
  User,
  Phone,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  ArrowRight,
  Coffee,
} from "lucide-react";

interface TableOrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableCode: string;
  customerName: string;
  customerPhone: string;
  cartItems: CartItem[];
  kitchenNotes?: string;
  onOrderSuccess: (orderNumber: string) => void;
  onEditCustomer: () => void;
}

export default function TableOrderReviewModal({
  isOpen,
  onClose,
  tableCode,
  customerName,
  customerPhone,
  cartItems,
  kitchenNotes,
  onOrderSuccess,
  onEditCustomer,
}: TableOrderReviewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  const handleConfirmOrder = () => {
    setIsSubmitting(true);
    // Simulate instantaneous local order dispatch
    setTimeout(() => {
      const generatedNo = `#TBW-${Math.floor(1000 + Math.random() * 9000)}`;
      setIsSubmitting(false);
      setConfirmedOrderNumber(generatedNo);
      onOrderSuccess(generatedNo);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-cafe-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cafe-200 bg-cafe-950 p-5 text-white">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-300" />
            <h3 className="font-serif text-lg font-bold">
              {confirmedOrderNumber ? "Order Confirmed!" : "Review Table Order"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmedOrderNumber ? (
          /* Order Confirmation View */
          <div className="p-6 sm:p-8 text-center space-y-5 animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 mb-2">
                Table {tableCode} &bull; Order {confirmedOrderNumber}
              </span>
              <h4 className="font-serif text-2xl font-bold text-cafe-950">
                Your Order is Received!
              </h4>
              <p className="mt-1 text-xs text-zinc-600 max-w-xs mx-auto">
                Thank you, <strong className="text-zinc-900">{customerName}</strong>. Our kitchen is preparing your selections now.
              </p>
            </div>

            {/* Status Card */}
            <div className="rounded-2xl border border-cafe-200 bg-cafe-50/70 p-4 text-left space-y-2 text-xs text-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Live Status:</span>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-bold text-amber-800">
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
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Payment:</span>
                <span className="font-semibold text-zinc-900">
                  Pay at Counter ({formatINR(grandTotal)})
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 text-[11px] text-amber-900 text-left">
              <strong>Phase 1 Demo Notice:</strong> This is a local interactive prototype. Real kitchen webhooks, counter payments, and database writes will activate in Phase 2 and 3.
            </div>

            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-sm font-bold text-white hover:bg-cafe-800 transition"
            >
              <Coffee className="h-4 w-4 text-amber-300" />
              <span>Back to Digital Menu</span>
            </button>
          </div>
        ) : (
          /* Order Review View */
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
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

            {/* Items Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Itemized Summary (Table {tableCode})
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
                          &bull; {c.optionName}
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

            {/* Bill Calculation */}
            <div className="rounded-2xl bg-zinc-50 p-4 space-y-1.5 text-xs text-zinc-600 border border-zinc-200">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated GST (5%)</span>
                <span>{formatINR(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-2 border-t border-zinc-200">
                <span>Grand Total</span>
                <span className="text-cafe-900">{formatINR(grandTotal)}</span>
              </div>
              <p className="text-[10px] text-zinc-400 pt-1">
                Settled in person at café counter upon dining completion.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Demo Mode:</strong> Placing this order records a local simulated ticket. No actual payment or live database modification occurs.
              </span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-cafe-800 disabled:opacity-50 transition active:scale-95"
            >
              {isSubmitting ? (
                <span>Dispatching Order to Barista...</span>
              ) : (
                <>
                  <span>Confirm &amp; Place Order for Table {tableCode}</span>
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

