"use client";

import React from "react";
import Image from "next/image";
import { CartItem, CafeOrder, TableSessionBill, OrderStatus } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Receipt,
  FileText,
  CheckCircle2,
  History,
} from "lucide-react";

interface TableCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  tableCode: string;
  cartItems: CartItem[];
  previousOrders?: CafeOrder[];
  currentSessionBill?: TableSessionBill | null;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onProceedToReview: () => void;
  kitchenNotes: string;
  onKitchenNotesChange: (notes: string) => void;
  onViewOrders?: () => void;
}

export default function TableCartDrawer({
  isOpen,
  onClose,
  onOpen,
  tableCode,
  cartItems,
  previousOrders = [],
  currentSessionBill,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToReview,
  kitchenNotes,
  onKitchenNotesChange,
  onViewOrders,
}: TableCartDrawerProps) {
  const newItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Decimal-safe calculations
  const previousSubtotal = previousOrders.reduce((acc, o) => acc + o.subtotal, 0);
  const newSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const newTax = Math.round(newSubtotal * 0.05 * 100) / 100;
  const newRoundTotal = newSubtotal + newTax;

  const combinedSubtotal = previousSubtotal + newSubtotal;
  const combinedTax = Math.round(combinedSubtotal * 0.05 * 100) / 100;
  const projectedGrandTotal = Math.round((combinedSubtotal + combinedTax) * 100) / 100;

  const paymentsReceived = currentSessionBill?.isPaid ? currentSessionBill.totalAmount : 0;
  const outstandingPayable = Math.max(0, projectedGrandTotal - paymentsReceived);

  const currentRound = previousOrders.length + 1;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "new":
        return { label: "Received", bg: "bg-amber-100 text-amber-900 border-amber-300" };
      case "accepted":
        return { label: "Accepted", bg: "bg-blue-100 text-blue-900 border-blue-300" };
      case "preparing":
        return { label: "Preparing", bg: "bg-orange-100 text-orange-900 border-orange-300" };
      case "ready":
        return { label: "Ready", bg: "bg-emerald-100 text-emerald-900 border-emerald-300" };
      case "served":
      case "completed":
        return { label: "Served", bg: "bg-zinc-100 text-zinc-900 border-zinc-300" };
      default:
        return { label: status, bg: "bg-zinc-100 text-zinc-800 border-zinc-200" };
    }
  };

  return (
    <>
      {/* Floating Bottom Bar when Drawer is closed */}
      {!isOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg animate-slide-up">
          {newItemsCount > 0 ? (
            <button
              onClick={onOpen}
              className="w-full flex items-center justify-between rounded-2xl bg-cafe-900 p-4 text-white shadow-2xl hover:bg-cafe-800 transition active:scale-98 border border-amber-400/40"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 font-bold">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white">
                    {newItemsCount}
                  </span>
                </div>
                <div className="text-left">
                  <span className="block text-xs font-semibold text-amber-300">
                    Table {tableCode} &bull; Round {currentRound}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {newItemsCount} new items &bull; {formatINR(newRoundTotal)}
                    {previousOrders.length > 0 && (
                      <span className="text-[11px] text-zinc-300 font-normal ml-1">
                        (Bill: {formatINR(projectedGrandTotal)})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                <span>View Cart</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ) : previousOrders.length > 0 && !currentSessionBill?.isPaid ? (
            <button
              onClick={onOpen}
              className="w-full flex items-center justify-between rounded-2xl bg-zinc-900/95 backdrop-blur-md p-3.5 text-white shadow-xl hover:bg-zinc-800 transition active:scale-98 border border-zinc-700"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-medium text-zinc-400">
                    Table {tableCode} Active Bill ({previousOrders.length} {previousOrders.length === 1 ? "order" : "orders"})
                  </span>
                  <span className="text-xs font-bold text-white">
                    Running Total: {formatINR(currentSessionBill?.totalAmount || 0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                <span>View Cart / Bill</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          ) : null}
        </div>
      )}

      {/* Cart Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-cafe-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cafe-200 bg-cafe-950 p-4 sm:p-5 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 font-bold">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-bold">
                      Table {tableCode} Cart
                    </h3>
                    {previousOrders.length > 0 && (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                        Round {currentRound}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {newItemsCount} new {newItemsCount === 1 ? "item" : "items"} in cart
                    {previousOrders.length > 0 && ` &bull; ${previousOrders.length} previous rounds`}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content with the 3 Mandatory Sections */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">

              {/* ============================================================== */}
              {/* SECTION A: PREVIOUS ORDERS (Confirmed & Dispatched to Kitchen)  */}
              {/* ============================================================== */}
              {previousOrders.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 uppercase tracking-wide">
                      <History className="h-4 w-4 text-amber-700" />
                      <span>Section A: Previously Ordered</span>
                      <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[10px]">
                        {previousOrders.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-800 font-medium">
                      In Kitchen &bull; Non-editable
                    </span>
                  </div>

                  <div className="space-y-3">
                    {previousOrders.map((ord, oIdx) => {
                      const badge = getStatusBadge(ord.status);

                      return (
                        <div
                          key={ord.id || oIdx}
                          className="rounded-xl border border-amber-200/70 bg-white p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900">
                                {ord.orderNumber}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                ({ord.createdAt})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                              <span className="font-extrabold text-zinc-900">
                                {formatINR(ord.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Line Items for this previous round */}
                          <div className="space-y-1 divide-y divide-zinc-50">
                            {ord.items.map((it, itIdx) => (
                              <div
                                key={itIdx}
                                className="pt-1 flex items-start justify-between text-[11px]"
                              >
                                <div>
                                  <span className="font-semibold text-zinc-800">
                                    {it.quantity} &times; {it.name}
                                  </span>
                                  {it.customizations && it.customizations.length > 0 && (
                                    <div className="text-[10px] text-zinc-500 ml-2 space-y-0.2">
                                      {it.customizations.map((c, cIdx) => (
                                        <span key={cIdx} className="block">
                                          &bull; {c.optionName} {c.priceDelta > 0 && `(+₹${c.priceDelta})`}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-zinc-400 block ml-2">
                                    Unit: {formatINR(it.unitPrice)}
                                  </span>
                                </div>
                                <span className="font-bold text-zinc-700">
                                  {formatINR(it.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-xs font-bold text-amber-950 pt-1 border-t border-amber-200/60">
                    <span>Previous Orders Subtotal</span>
                    <span>{formatINR(previousSubtotal)}</span>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* SECTION B: CURRENT CART (New Selected Items)                    */}
              {/* ============================================================== */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 uppercase tracking-wide">
                    <ShoppingBag className="h-4 w-4 text-cafe-700" />
                    <span>Section B: Current Cart (New Items)</span>
                    {newItemsCount > 0 && (
                      <span className="rounded-full bg-cafe-900 text-white px-1.5 py-0.2 text-[10px]">
                        {newItemsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {newItemsCount > 0 ? "Adjust qty or customize" : "Empty"}
                  </span>
                </div>

                {cartItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-400 bg-zinc-50/60">
                    <ShoppingBag className="h-8 w-8 text-zinc-300 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-zinc-700">
                      No new items in this round
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {previousOrders.length > 0
                        ? "Select additional items from the menu to add to your table's running bill."
                        : "Browse our digital menu and tap 'Add' to choose your first dish."}
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-3 rounded-xl bg-cafe-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-cafe-800 transition"
                    >
                      Browse Digital Menu
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="flex gap-3 rounded-2xl border border-zinc-200 p-3 bg-zinc-50/70"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-200">
                          <Image
                            src={item.menuItem.image}
                            alt={item.menuItem.name}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold text-zinc-900 line-clamp-1">
                                {item.menuItem.name}
                              </h4>
                              <button
                                onClick={() => onRemoveItem(item.cartItemId)}
                                className="text-zinc-400 hover:text-red-600 transition"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Customizations tags */}
                            {item.selectedCustomizations.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.selectedCustomizations.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-block mr-1 text-[10px] text-zinc-500 bg-zinc-200/60 rounded px-1.5 py-0.2"
                                  >
                                    {c.optionName} {c.priceDelta > 0 && `(+₹${c.priceDelta})`}
                                  </span>
                                ))}
                              </div>
                            )}

                            <span className="text-[10px] text-zinc-400 block mt-0.5">
                              Unit Price: {formatINR(item.unitPrice)}
                            </span>
                          </div>

                          {/* Quantity and Price */}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-cafe-900">
                              {formatINR(item.totalPrice)}
                            </span>

                            <div className="flex items-center rounded-lg border border-zinc-300 bg-white">
                              <button
                                onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                className="p-1 text-zinc-600 hover:text-black transition"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-zinc-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                className="p-1 text-zinc-600 hover:text-black transition"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Kitchen Special Notes for this Round */}
                    <div className="pt-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1">
                        <FileText className="h-3.5 w-3.5 text-cafe-600" />
                        <span>Kitchen Instructions for this round (Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={kitchenNotes}
                        onChange={(e) => onKitchenNotesChange(e.target.value)}
                        placeholder="e.g. Extra hot espresso, sugar on side, allergy note..."
                        className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                      />
                    </div>

                    {/* New Items Subtotal & Tax Preview */}
                    <div className="rounded-xl bg-zinc-100/70 p-2.5 text-xs text-zinc-700 space-y-1 border border-zinc-200">
                      <div className="flex justify-between">
                        <span>New Items Subtotal</span>
                        <span className="font-bold">{formatINR(newSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500 text-[11px]">
                        <span>Applicable GST (5%) on new items</span>
                        <span>{formatINR(newTax)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                        <span>Round {currentRound} Amount</span>
                        <span className="text-cafe-900">{formatINR(newRoundTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ============================================================== */}
              {/* SECTION C: RUNNING BILL (Combined Projected Total)              */}
              {/* ============================================================== */}
              <div className="rounded-2xl border-2 border-cafe-300 bg-cafe-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-cafe-200 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cafe-950 uppercase tracking-wide">
                    <Receipt className="h-4 w-4 text-cafe-800" />
                    <span>Section C: Running Table Bill</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 rounded px-1.5 py-0.5">
                    Pay at Counter
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-700">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Previous Confirmed Orders Subtotal:</span>
                    <span className="font-semibold">{formatINR(previousSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">New Unsubmitted Items Subtotal:</span>
                    <span className="font-semibold text-cafe-900">+{formatINR(newSubtotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-1 text-zinc-600">
                    <span>Combined Subtotal:</span>
                    <span className="font-bold">{formatINR(combinedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Discounts:</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Applicable GST (5%):</span>
                    <span>{formatINR(combinedTax)}</span>
                  </div>

                  <div className="flex justify-between text-sm font-extrabold text-zinc-900 pt-2 border-t border-zinc-300">
                    <span>Combined Projected Total:</span>
                    <span className="text-cafe-900 font-serif text-base font-black">
                      {formatINR(projectedGrandTotal)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-zinc-500 pt-0.5">
                    <span>Payments Already Received:</span>
                    <span>{formatINR(paymentsReceived)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-900 bg-emerald-50 rounded-lg p-2 border border-emerald-200 mt-1">
                    <span>Outstanding Payable:</span>
                    <span className="font-black">{formatINR(outstandingPayable)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Calculation & Action Buttons */}
            <div className="border-t border-zinc-200 bg-zinc-50 p-4 space-y-2">
              {cartItems.length > 0 ? (
                <button
                  onClick={onProceedToReview}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-cafe-800 transition active:scale-95"
                >
                  <Receipt className="h-4 w-4 text-amber-300" />
                  <span>
                    Review &amp; Place Round {currentRound} &bull; {formatINR(newRoundTotal)}
                  </span>
                </button>
              ) : previousOrders.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-600 justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>All {previousOrders.length} previous rounds are placed with kitchen</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onViewOrders) onViewOrders();
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-xs font-bold text-white hover:bg-cafe-800 transition"
                  >
                    <span>View Live Kitchen Status &amp; Bill</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-300" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
