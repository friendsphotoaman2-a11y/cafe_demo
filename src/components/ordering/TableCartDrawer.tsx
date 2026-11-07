"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CartItem } from "@/lib/types";
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
} from "lucide-react";

interface TableCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  tableCode: string;
  cartItems: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onProceedToReview: () => void;
  kitchenNotes: string;
  onKitchenNotesChange: (notes: string) => void;
}

export default function TableCartDrawer({
  isOpen,
  onClose,
  onOpen,
  tableCode,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToReview,
  kitchenNotes,
  onKitchenNotesChange,
}: TableCartDrawerProps) {
  const totalItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const tax = subtotal * 0.05; // 5% GST
  const grandTotal = subtotal + tax;

  return (
    <>
      {/* Floating Bottom Bar when Cart has items and Drawer is closed */}
      {!isOpen && totalItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg animate-slide-up">
          <button
            onClick={onOpen}
            className="w-full flex items-center justify-between rounded-2xl bg-cafe-900 p-4 text-white shadow-2xl hover:bg-cafe-800 transition active:scale-98 border border-amber-400/30"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 font-bold">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white">
                  {totalItemCount}
                </span>
              </div>
              <div className="text-left">
                <span className="block text-xs font-semibold text-amber-300">
                  Table {tableCode} Order
                </span>
                <span className="text-sm font-bold text-white">
                  {totalItemCount} {totalItemCount === 1 ? "item" : "items"} &bull;{" "}
                  {formatINR(grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-300">
              <span>View Cart</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-cafe-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cafe-200 bg-cafe-950 p-5 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 font-bold">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold">
                    Table {tableCode} Cart
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {totalItemCount} {totalItemCount === 1 ? "item" : "items"} selected
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

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
                  <ShoppingBag className="h-12 w-12 text-zinc-300 mb-3" />
                  <p className="text-sm font-semibold text-zinc-700">
                    Your table cart is empty
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                    Browse our digital menu and tap &ldquo;Add&rdquo; on any dish or beverage to start your order.
                  </p>
                </div>
              ) : (
                <>
                  {cartItems.map((item) => (
                    <div
                      key={item.cartItemId}
                      className="flex gap-3 rounded-2xl border border-zinc-200/80 p-3 bg-zinc-50/50"
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

                      {/* Info & Options */}
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
                                  {c.optionName}
                                </span>
                              ))}
                            </div>
                          )}
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

                  {/* Kitchen Special Notes */}
                  <div className="pt-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1">
                      <FileText className="h-3.5 w-3.5 text-cafe-600" />
                      <span>Kitchen Instructions (Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={kitchenNotes}
                      onChange={(e) => onKitchenNotesChange(e.target.value)}
                      placeholder="e.g. Please serve flat white extra hot, dressing on side..."
                      className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer Calculation & Checkout Button */}
            {cartItems.length > 0 && (
              <div className="border-t border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <div className="space-y-1.5 text-xs text-zinc-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>{formatINR(tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-zinc-900 pt-1 border-t border-zinc-200">
                    <span>Total Amount</span>
                    <span className="text-cafe-900">{formatINR(grandTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={onProceedToReview}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-sm font-bold text-white shadow-md hover:bg-cafe-800 transition active:scale-95"
                >
                  <Receipt className="h-4 w-4 text-amber-300" />
                  <span>Review &amp; Place Order &bull; {formatINR(grandTotal)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

