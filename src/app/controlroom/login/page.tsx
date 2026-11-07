"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Coffee,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import ControlRoomHeader from "@/components/controlroom/Header";

export default function ControlRoomLoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("owner");
  const [demoEmail, setDemoEmail] = useState("owner@brewandbean.in");

  const roles = [
    { id: "owner", title: "Café Owner", email: "owner@brewandbean.in" },
    { id: "cashier", title: "Head Cashier", email: "cashier@brewandbean.in" },
    { id: "kitchen", title: "Kitchen Chef", email: "kitchen@brewandbean.in" },
  ];

  const handleRoleSelect = (role: (typeof roles)[0]) => {
    setSelectedRole(role.id);
    setDemoEmail(role.email);
  };

  const handleDemoSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/controlroom");
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Staff &amp; Admin Login"
        subtitle="Staff authentication portal UI preview (Protected Supabase Auth arrives in Phase 3)"
      />

      <div className="max-w-xl mx-auto space-y-6 pt-4">
        {/* Transparent Security Notice */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Phase 1 Architectural Notice — Not Connected to Live Auth</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800">
            This screen is a UI prototype. In Phase 3, secure Supabase Authentication, password hashing, and role-based access control (Owner, Cashier, Kitchen) will be wired up. For Phase 1, clicking &ldquo;Enter Control Room Preview&rdquo; allows you to explore the admin features with fictional fixtures.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-amber-300 mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-zinc-900">
              Staff Control Room Sign In
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Select a simulated staff profile to test role views
            </p>
          </div>

          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSelect(r)}
                className={`rounded-xl border p-2.5 text-center text-xs font-semibold transition ${
                  selectedRole === r.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {r.title}
              </button>
            ))}
          </div>

          <form onSubmit={handleDemoSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Staff Email
              </label>
              <input
                type="email"
                value={demoEmail}
                readOnly
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Access PIN / Password
              </label>
              <input
                type="password"
                value="••••••••••"
                readOnly
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600 cursor-not-allowed"
              />
              <span className="block text-[11px] text-zinc-400 mt-1">
                Pre-filled for Phase 1 demo exploration
              </span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-95"
            >
              <UserCheck className="h-4 w-4 text-amber-300" />
              <span>Enter Control Room Preview</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

