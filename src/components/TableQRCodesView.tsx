'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CafeTable } from '@/types/database';
import {
  QrCode,
  Printer,
  Copy,
  Check,
  Download,
  ExternalLink,
} from 'lucide-react';
import { withBasePathUrl } from '@/lib/base-path';

interface Props {
  tables: CafeTable[];
  cafeName?: string;
  settings?: { cafe_name?: string } | null;
}

export function TableQRCodesView({ tables, cafeName, settings }: Props) {
  const displayCafeName = cafeName || settings?.cafe_name || 'Brew & Bites Cafe';
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('ALL');

  // Determine application base domain from environment variable or window, ensuring basePath is always included
  const rawDomain =
    process.env.NEXT_PUBLIC_ORDERING_BASE_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.thebusinesswork.com');
  const cleanDomain = withBasePathUrl(rawDomain).replace(/\/+$/, '');

  // Generate high-resolution QR codes for each table
  useEffect(() => {
    async function generateAllQRs() {
      const map: Record<string, string> = {};
      for (const table of tables) {
        const url = `${cleanDomain}/t/${table.table_code.toLowerCase()}`;
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            width: 600,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#1c1917',
              light: '#ffffff',
            },
          });
          map[table.id] = dataUrl;
        } catch (err) {
          console.error('Failed to generate QR for table:', table.table_number, err);
        }
      }
      setQrMap(map);
    }

    if (tables.length > 0) {
      generateAllQRs();
    }
  }, [tables, cleanDomain]);

  // Copy single table URL
  function handleCopy(table: CafeTable) {
    const url = `${cleanDomain}/t/${table.table_code.toLowerCase()}`;
    navigator.clipboard.writeText(url);
    setCopiedId(table.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Copy all table URLs for bulk NFC tag programming
  function handleCopyAll() {
    const lines = tables.map(
      t => `${t.table_number}: ${cleanDomain}/t/${t.table_code.toLowerCase()}`
    );
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  }

  // Trigger browser print
  function handlePrintSheet() {
    window.print();
  }

  const filteredTables =
    selectedTableId === 'ALL'
      ? tables
      : tables.filter(t => t.id === selectedTableId);

  return (
    <div className="space-y-6">
      {/* Header and Bulk Action Bar (Hidden when printing) */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <QrCode className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white tracking-tight">
              Table QR Codes &amp; NFC Standees
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1 max-w-xl">
            High-contrast, high-resolution QR codes mapped to digital table links. Print on acrylic standees or copy URLs to write to NFC tags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Table filter dropdown */}
          <select
            value={selectedTableId}
            onChange={e => setSelectedTableId(e.target.value)}
            className="bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Tables ({tables.length})</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>
                {t.table_number} ({t.table_code})
              </option>
            ))}
          </select>

          {/* Copy all URLs button for NFC */}
          <button
            onClick={handleCopyAll}
            className="px-3.5 py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">URLs Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-400" />
                <span>Copy All URLs</span>
              </>
            )}
          </button>

          {/* Print Sheet Button */}
          <button
            onClick={handlePrintSheet}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 text-xs font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer select-none"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee Sheet</span>
          </button>
        </div>
      </div>

      {/* Grid of Standee Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4 print:p-0">
        {filteredTables.map(table => {
          const url = `${cleanDomain}/t/${table.table_code.toLowerCase()}`;
          const qrData = qrMap[table.id];

          return (
            <div
              key={table.id}
              className="bg-stone-900 border border-stone-800 hover:border-amber-500/40 rounded-3xl p-5 shadow-xl transition flex flex-col justify-between group print:border-2 print:border-dashed print:border-gray-400 print:bg-white print:p-4 print:shadow-none print:break-inside-avoid"
            >
              <div>
                {/* Standee Header */}
                <div className="text-center pb-3 border-b border-stone-800 print:border-gray-200">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 print:text-amber-800 block">
                    {displayCafeName}
                  </span>
                  <h3 className="text-xl font-black text-white print:text-black tracking-tight mt-0.5">
                    {table.table_number}
                  </h3>
                  <p className="text-[11px] text-stone-400 print:text-gray-600 font-medium">
                    Scan QR or Tap NFC to Order
                  </p>
                </div>

                {/* QR Code Canvas */}
                <div className="my-4 flex justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow-sm inline-block border border-stone-200">
                    {qrData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrData}
                        alt={`QR code for ${table.table_number}`}
                        className="w-40 h-40 object-contain mx-auto"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-stone-400">
                        <QrCode className="w-10 h-10 animate-pulse text-stone-300" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Code Pill and PIN Instructions */}
                <div className="text-center space-y-1.5">
                  <span className="inline-block px-3 py-1 rounded-full bg-stone-800 print:bg-gray-100 text-stone-300 print:text-black font-mono font-bold text-xs border border-stone-700 print:border-gray-300">
                    Code: {table.table_code}
                  </span>
                  <p className="text-[10px] text-stone-400 print:text-gray-600">
                    Ask staff for the 4-digit PIN to begin ordering
                  </p>
                </div>

                {/* Target URL */}
                <div className="mt-3 px-2 py-1.5 rounded-lg bg-stone-950/80 print:bg-gray-50 border border-stone-800 print:border-gray-200 text-center">
                  <p className="text-[10px] font-mono text-stone-400 print:text-gray-600 break-all select-all">
                    {url}
                  </p>
                </div>
              </div>

              {/* Action Buttons (Hidden when printing) */}
              <div className="mt-4 pt-3 border-t border-stone-800 flex items-center gap-2 print:hidden">
                <button
                  onClick={() => handleCopy(table)}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition cursor-pointer select-none"
                  title="Copy ordering URL for NFC tag"
                >
                  {copiedId === table.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>NFC URL</span>
                    </>
                  )}
                </button>

                {qrData && (
                  <a
                    href={qrData}
                    download={`table-${table.table_code}-qr.png`}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 border border-stone-700 transition flex items-center justify-center"
                    title="Download PNG for printing"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}

                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 border border-amber-500/30 transition flex items-center justify-center"
                  title="Open table order page in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
