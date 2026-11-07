"use client";

import React, { useState, useEffect } from "react";
import ControlRoomHeader from "@/components/controlroom/Header";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { CafeSettings } from "@/lib/types";
import {
  Settings,
  Save,
  Building2,
  Receipt,
  Wifi,
  Clock,
  Printer,
  Sparkles,
  CheckCircle2,
  QrCode,
  Database,
  RefreshCw,
  AlertCircle,
  FileCode,
  Server,
  ShieldCheck,
} from "lucide-react";

export default function ControlRoomSettingsPage() {
  const [settings, setSettings] = useState<CafeSettings>(DEMO_SETTINGS);
  const [savedToast, setSavedToast] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    loading: boolean;
    connected?: boolean;
    migrated?: boolean;
    error?: string;
    hint?: string;
  }>({ loading: true });

  const checkDbStatus = async () => {
    setDbStatus({ loading: true });
    try {
      const res = await fetch("/api/supabase/status");
      const data = await res.json();
      setDbStatus({
        loading: false,
        connected: data.connected,
        migrated: data.migrated,
        error: data.error,
        hint: data.hint,
      });
    } catch (err: unknown) {
      setDbStatus({
        loading: false,
        connected: false,
        migrated: false,
        error: err instanceof Error ? err.message : "Network error testing database connection",
      });
    }
  };

  useEffect(() => {
    checkDbStatus();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Café Configuration &amp; Settings"
        subtitle="Manage tax rates (5% GST), billing currency, guest Wi-Fi credentials, and operating parameters"
      />

      {savedToast && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">
            Settings updated successfully in local demo session!
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Café Identity */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Building2 className="h-5 w-5 text-amber-600" />
            <h3 className="font-serif text-lg font-bold text-zinc-900">
              Café Brand &amp; Location
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Brand Name
              </label>
              <input
                type="text"
                value={settings.brandName}
                onChange={(e) =>
                  setSettings({ ...settings, brandName: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) =>
                  setSettings({ ...settings, tagline: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold block text-zinc-700 mb-1">
                Physical Street Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) =>
                  setSettings({ ...settings, address: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Locality / Area
              </label>
              <input
                type="text"
                value={settings.area}
                onChange={(e) =>
                  setSettings({ ...settings, area: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                City &amp; PIN Code
              </label>
              <input
                type="text"
                value={`${settings.city} – ${settings.postalCode}`}
                readOnly
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Financial & Tax Details */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Receipt className="h-5 w-5 text-amber-600" />
            <h3 className="font-serif text-lg font-bold text-zinc-900">
              Tax, Currency &amp; UPI
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                GSTIN Registration Number
              </label>
              <input
                type="text"
                value={settings.gstNumber}
                onChange={(e) =>
                  setSettings({ ...settings, gstNumber: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Restaurant GST Rate (%)
              </label>
              <input
                type="number"
                value={settings.gstRatePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    gstRatePercent: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Counter UPI VPA (ID)
              </label>
              <input
                type="text"
                value={settings.upiId}
                onChange={(e) =>
                  setSettings({ ...settings, upiId: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Guest Wi-Fi & Hours */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Wifi className="h-5 w-5 text-amber-600" />
            <h3 className="font-serif text-lg font-bold text-zinc-900">
              Guest Wi-Fi &amp; Hours
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Guest Wi-Fi SSID
              </label>
              <input
                type="text"
                value={settings.wifiSsid}
                onChange={(e) =>
                  setSettings({ ...settings, wifiSsid: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Wi-Fi Password
              </label>
              <input
                type="text"
                value={settings.wifiPassword}
                onChange={(e) =>
                  setSettings({ ...settings, wifiPassword: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Operating Schedule
              </label>
              <input
                type="text"
                value={settings.openingHours}
                onChange={(e) =>
                  setSettings({ ...settings, openingHours: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Supabase Cloud Database & Migrations */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-600" />
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Supabase Cloud Database &amp; Realtime Sync
              </h3>
            </div>
            <button
              type="button"
              onClick={checkDbStatus}
              disabled={dbStatus.loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${dbStatus.loading ? "animate-spin" : ""}`} />
              Check Status
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-500 text-[11px] uppercase tracking-wider">
                  Project Configuration
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Configured
                </span>
              </div>
              <p className="font-mono text-zinc-800 text-[11px] break-all">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || "Configured via environment"}
              </p>
              <p className="text-[10px] text-zinc-500">
                Project Host: <span className="font-mono font-bold text-zinc-700">{process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "Configured"}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-500 text-[11px] uppercase tracking-wider">
                  Live DB Health
                </span>
                {dbStatus.loading ? (
                  <span className="text-[11px] text-zinc-500">Inspecting...</span>
                ) : dbStatus.migrated ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Schema Active
                  </span>
                ) : dbStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" /> Connected (Pending SQL)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                    Local Resilient Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-600">
                {dbStatus.migrated
                  ? "All 18 tables, RLS policies, and Realtime channels are active and syncing."
                  : dbStatus.hint || "Local state preserves full workflow until migrations run in Supabase SQL Editor."}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-3 space-y-2">
            <h4 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
              <FileCode className="h-4 w-4 text-amber-600" />
              SQL Migration Files Ready for Supabase SQL Editor:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl border border-zinc-200 bg-white p-2.5">
                <span className="font-mono font-bold text-zinc-800 block">1. 20261107000001_initial_cafe_schema.sql</span>
                <span className="text-zinc-500 text-[10px]">18 tables, RLS policies, indexes &amp; realtime publication</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-2.5">
                <span className="font-mono font-bold text-zinc-800 block">2. 20261107000002_seed_demo_restaurant.sql</span>
                <span className="text-zinc-500 text-[10px]">Brew &amp; Bean café records, 12 tables, 6 categories &amp; items</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thermal Printer Integration Preview */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-amber-600" />
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Kitchen &amp; Cashier ESC/POS Thermal Printer
              </h3>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
              Phase 2 Preview
            </span>
          </div>

          <p className="text-xs text-zinc-500">
            Hardware interface for automatic 80mm kitchen ticket printing upon table order placement.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Printer IP / Network Address
              </label>
              <input
                type="text"
                placeholder="192.168.1.180:9100"
                readOnly
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-mono text-zinc-500"
              />
            </div>

            <div>
              <label className="font-semibold block text-zinc-700 mb-1">
                Receipt Paper Width
              </label>
              <input
                type="text"
                value="80mm Thermal (Standard)"
                readOnly
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-95"
          >
            <Save className="h-4 w-4 text-amber-300" />
            <span>Save Configuration Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}

