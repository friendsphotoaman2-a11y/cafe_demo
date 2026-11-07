"use client";

import React, { useState } from "react";
import { User, Phone, Check, ShieldCheck, X } from "lucide-react";

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
      setError("Please enter your full name.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-cafe-200">
        {/* Header */}
        <div className="bg-cafe-950 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30 mb-2">
            Table {tableCode} &bull; Brew &amp; Bean Café
          </div>
          <h3 className="font-serif text-2xl font-bold">
            Welcome to Your Table
          </h3>
          <p className="mt-1 text-xs text-zinc-300">
            Please share your name and mobile number to associate your table order and earn loyalty rewards.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Your Full Name *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
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
                className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Mobile Number *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
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
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              No password or account creation required.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-cafe-50 p-3 text-xs text-cafe-800 border border-cafe-200/50">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Used only for your table session and barista order updates.</span>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-cafe-900 py-3 text-sm font-bold text-white shadow-md hover:bg-cafe-800 transition active:scale-95"
          >
            <Check className="h-4 w-4 text-amber-300" />
            <span>Confirm &amp; Continue Ordering</span>
          </button>
        </form>
      </div>
    </div>
  );
}

