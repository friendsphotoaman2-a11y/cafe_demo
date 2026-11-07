"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CafeTable } from "@/lib/types";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import {
  generateTableQrDataUrl,
  getTableOrderingUrl,
} from "@/lib/qr-generator";
import { Printer, X, Coffee } from "lucide-react";

interface PrintAllQrSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tables: CafeTable[];
  customBaseUrl?: string;
}

export default function PrintAllQrSheet({
  isOpen,
  onClose,
  tables,
  customBaseUrl,
}: PrintAllQrSheetProps) {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    async function loadAllQrs() {
      const results: Record<string, string> = {};
      for (const t of tables) {
        results[t.code] = await generateTableQrDataUrl(t.code, t.qrNonce, customBaseUrl);
      }
      if (isMounted) {
        setQrMap(results);
        setIsGenerating(false);
      }
    }

    loadAllQrs();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tables, customBaseUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/90 backdrop-blur-md overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:static print:h-auto">
      {/* Top Controls Bar (hidden during print) */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-2xl bg-zinc-950 p-4 text-white shadow-xl mb-6 border border-zinc-800 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-bold">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold">
              Bulk Table QR Stand Sheets
            </h3>
            <p className="text-xs text-zinc-400">
              {tables.length} Table Tent Cards &bull; Standard A4 Cut Sheet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-300 transition active:scale-95 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            <span>{isGenerating ? "Preparing QRs..." : "Print All Cards"}</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Grid (2 columns on A4) */}
      <div className="mx-auto w-full max-w-5xl bg-white rounded-3xl p-6 sm:p-10 shadow-2xl print:shadow-none print:p-0 print:max-w-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          {tables.map((table) => {
            const qrSrc = qrMap[table.code];

            return (
              <div
                key={table.id}
                className="relative flex flex-col justify-between rounded-3xl border-2 border-dashed border-zinc-300 p-6 text-center bg-gradient-to-b from-[#FAF7F2] to-white break-inside-avoid print:border-2 print:border-zinc-400"
              >
                {/* Brand */}
                <div>
                  <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-cafe-700 mb-1">
                    <Coffee className="h-3.5 w-3.5 text-amber-600" />
                    <span>{DEMO_SETTINGS.brandName}</span>
                  </div>
                  <h3 className="font-serif text-xl font-black text-cafe-950">
                    Scan Table Menu &amp; Order
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    Freshly brewed to your seat &bull; {table.section}
                  </p>
                </div>

                {/* Table Badge */}
                <div className="my-3 mx-auto inline-block rounded-full bg-cafe-900 px-5 py-1 text-center shadow-xs">
                  <span className="font-serif text-base font-extrabold text-amber-300">
                    TABLE {table.code}
                  </span>
                </div>

                {/* QR Code */}
                <div className="my-2 flex justify-center">
                  <div className="rounded-2xl border-2 border-zinc-200 bg-white p-2.5 shadow-sm">
                    {qrSrc ? (
                      <Image
                        src={qrSrc}
                        alt={`QR Code Table ${table.code}`}
                        width={144}
                        height={144}
                        unoptimized
                        className="h-36 w-36 object-contain"
                      />
                    ) : (
                      <div className="flex h-36 w-36 items-center justify-center text-xs text-zinc-400">
                        Generating...
                      </div>
                    )}
                  </div>
                </div>

                {/* Exact Encoded URL Confirmation */}
                <div className="px-2 my-1">
                  <span className="font-mono text-[9px] font-bold text-zinc-800 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 block truncate select-all">
                    {getTableOrderingUrl(table.code, table.qrNonce, customBaseUrl)}
                  </span>
                </div>

                {/* Instructions */}
                <div className="space-y-0.5">
                  <p className="font-serif text-xs font-bold text-cafe-950">
                    Open Camera &bull; Scan QR &bull; Pay at Counter
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    Free Guest Wi-Fi: <span className="font-mono font-semibold">{DEMO_SETTINGS.wifiSsid}</span>
                  </p>
                </div>

                {/* Cut line helper */}
                <div className="mt-3 pt-2 border-t border-dotted border-zinc-300 text-[9px] text-zinc-400 flex items-center justify-between">
                  <span>✂ Fold or Cut Along Dotted Frame</span>
                  <span>{table.capacity} Person Table</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

