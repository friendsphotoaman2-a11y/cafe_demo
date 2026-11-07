"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CafeTable } from "@/lib/types";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import {
  generateTableQrDataUrl,
  getTableOrderingUrl,
} from "@/lib/qr-generator";
import {
  QrCode,
  Download,
  Printer,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  Check,
  Wifi,
  Sparkles,
} from "lucide-react";

interface TableQrModalProps {
  table: CafeTable | null;
  isOpen: boolean;
  onClose: () => void;
  onRegenerateQr: (tableCode: string) => void;
  customBaseUrl?: string;
}

export default function TableQrModal({
  table,
  isOpen,
  onClose,
  onRegenerateQr,
  customBaseUrl,
}: TableQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (table && isOpen) {
      generateTableQrDataUrl(table.code, table.qrNonce, customBaseUrl).then(setQrDataUrl);
    }
  }, [table, isOpen, customBaseUrl]);

  if (!isOpen || !table) return null;

  const orderingUrl = getTableOrderingUrl(table.code, table.qrNonce, customBaseUrl);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(orderingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `BrewBean-Table-${table.code}-QR.png`;
    link.click();
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    setTimeout(() => {
      onRegenerateQr(table.code);
      setRegenerating(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
      <div className="relative flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-zinc-200 print:border-none print:shadow-none">
        {/* Header (hidden in print) */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-950 p-5 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-bold">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold">
                Table {table.code} QR &amp; Stand Card
              </h3>
              <p className="text-[11px] text-zinc-400">{table.section}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Printable Tent Card Container */}
          <div
            id="printable-tent-card"
            className="mx-auto max-w-sm rounded-3xl border-2 border-cafe-900 bg-gradient-to-b from-[#FAF7F2] to-white p-6 text-center shadow-lg print:shadow-none print:border-2"
          >
            {/* Brand Header */}
            <div className="mb-3 space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-cafe-700">
                Welcome To
              </span>
              <h2 className="font-serif text-2xl font-black text-cafe-950">
                {DEMO_SETTINGS.brandName}
              </h2>
              <p className="text-[11px] font-medium text-zinc-500">
                {DEMO_SETTINGS.tagline}
              </p>
            </div>

            {/* Table Badge */}
            <div className="my-3 inline-block rounded-full bg-cafe-900 px-6 py-1.5 shadow-sm">
              <span className="font-serif text-lg font-extrabold text-amber-300">
                TABLE {table.code}
              </span>
            </div>

            {/* High-Resolution QR */}
            <div className="my-4 flex justify-center">
              <div className="rounded-2xl border-4 border-cafe-900/10 bg-white p-3 shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code for Table ${table.code}`}
                    className="h-48 w-48 object-contain"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center text-xs text-zinc-400">
                    Generating QR...
                  </div>
                )}
              </div>
            </div>

            {/* Exact Encoded URL Confirmation */}
            <div className="my-2.5 rounded-xl bg-amber-50/80 p-2 border border-amber-200/80">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-800 block">
                Encoded Scan URL
              </span>
              <p className="font-mono text-[11px] font-bold text-zinc-900 break-all select-all">
                {orderingUrl}
              </p>
            </div>

            {/* Instruction */}
            <div className="space-y-1">
              <p className="font-serif text-sm font-bold text-cafe-950">
                Point Phone Camera to Order
              </p>
              <p className="text-[11px] text-zinc-600 leading-tight">
                No app download required &bull; Browse full digital menu, customize coffee, and pay at counter.
              </p>
            </div>

            {/* Wi-Fi Footnote */}
            <div className="mt-4 pt-3 border-t border-dashed border-cafe-300 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
              <Wifi className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>
                Wi-Fi: <strong className="font-mono text-zinc-900">{DEMO_SETTINGS.wifiSsid}</strong> | Key: <strong className="font-mono text-zinc-900">{DEMO_SETTINGS.wifiPassword}</strong>
              </span>
            </div>
          </div>

          {/* URL Box & Actions (hidden during print) */}
          <div className="space-y-4 print:hidden">
            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                Direct Ordering Web Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={orderingUrl}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-mono text-zinc-700 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-zinc-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={handleDownloadPng}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 px-3 font-bold text-white hover:bg-zinc-800 transition"
              >
                <Download className="h-4 w-4 text-amber-300" />
                <span>Save PNG</span>
              </button>

              <button
                onClick={handlePrintCard}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 py-2.5 px-3 font-bold text-zinc-800 hover:bg-zinc-100 transition"
              >
                <Printer className="h-4 w-4 text-zinc-600" />
                <span>Print Card</span>
              </button>

              <a
                href={orderingUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 py-2.5 px-3 font-bold text-zinc-800 hover:bg-zinc-100 transition text-center"
              >
                <ExternalLink className="h-4 w-4 text-zinc-600" />
                <span>Test Link</span>
              </a>

              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 px-3 font-bold text-amber-900 hover:bg-amber-100 transition"
              >
                <RefreshCw
                  className={`h-4 w-4 text-amber-700 ${
                    regenerating ? "animate-spin" : ""
                  }`}
                />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

