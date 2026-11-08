"use client";

import React, { useState } from "react";
import { User, Phone, Check, ShieldCheck, X, Coffee, Award } from "lucide-react";

interface TableCustomerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableCode: string;
  initialName?: string;
  initialPhone?: string;
  onSaveCustomer: (name: string, phone: string) => void;
}

export default function TableCustomerOnboardingModal({
  isOpen,
  onClose,
  tableCode,
  initialName = "",
  initialPhone = "",
  onSaveCustomer,
}: TableCustomerOnboardingModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setError(null);
    onSaveCustomer(name.trim(), phone.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-zinc-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-black text-amber-300 border border-amber-400/30 mb-2">
            <Coffee className="h-3.5 w-3.5" />
            <span>Table {tableCode} &bull; Digital Ordering</span>
          </div>

          <h3 className="font-serif text-2xl font-black text-white">
            Welcome to Your Table
          </h3>
          <p className="mt-1 text-xs text-zinc-300 font-light leading-relaxed max-w-xs mx-auto">
            Provide your details so our baristas can deliver your order and record your 5-stamp loyalty progress.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold animate-shake">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              Your Name *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Arjun Verma"
                className="w-full rounded-2xl border border-zinc-200 py-3 pl-10 pr-3 text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              Mobile Number (10 Digits) *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <Phone className="h-4 w-4" />
              </div>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                }}
                placeholder="9876543210"
                maxLength={13}
                className="w-full rounded-2xl border border-zinc-200 py-3 pl-10 pr-3 text-sm focus:border-zinc-900 focus:outline-none transition shadow-xs"
              />
            </div>
          </div>

          {/* Loyalty Banner */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-950 border border-amber-200/80">
            <Award className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="leading-snug">
              <strong className="block font-bold">5-Stamp Free Coffee Program</strong>
              <span className="text-[11px] text-amber-900">
                Earn 1 digital stamp for this paid visit. 5 stamps = 6th coffee is complimentary!
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>No passwords required &bull; Remembered for up to 90 days.</span>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 py-3.5 text-sm font-black text-white shadow-md hover:bg-zinc-800 transition active:scale-95"
          >
            <Check className="h-4 w-4 text-amber-300" />
            <span>Continue to Table Menu</span>
          </button>
        </form>
      </div>
    </div>
  );
}
