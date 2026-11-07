"use client";

import React, { useState } from "react";
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
} from "lucide-react";

export default function ControlRoomSettingsPage() {
  const [settings, setSettings] = useState<CafeSettings>(DEMO_SETTINGS);
  const [savedToast, setSavedToast] = useState(false);

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

