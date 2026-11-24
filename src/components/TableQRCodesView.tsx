'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CafeTable, ManagerSettings } from '@/types/database';
import { withBasePathUrl } from '@/lib/base-path';
import {
  Printer,
  Copy,
  Check,
  Download,
  QrCode,
  ShieldAlert,
  Smartphone,
  ExternalLink,
  Sparkles,
  Scissors,
  Radio,
} from 'lucide-react';

interface Props {
  tables: CafeTable[];
  settings: ManagerSettings;
}

export function TableQRCodesView({ tables, settings }: Props) {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('ALL');

  // Determine application base domain from environment variable or window
  const appDomain =
    process.env.NEXT_PUBLIC_ORDERING_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined'
      ? withBasePathUrl(window.location.origin)
      : 'https://www.thebusinesswork.com/demo/cafe');
  const cleanDomain = appDomain.replace(/\/+$/, '');

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

  // Download individual QR code PNG
  function handleDownloadPNG(table: CafeTable) {
    const dataUrl = qrMap[table.id];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${table.table_number.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Print Stand Cards (triggers window.print)
  function handlePrint() {
    window.print();
  }

  const tablesToDisplay =
    selectedTableId === 'ALL'
      ? tables
      : tables.filter(t => t.id === selectedTableId);

  return (
    <div className="space-y-8">
      {/* Print-specific style overrides */}
      <style jsx global>{`
        @media print {
          /* Hide everything in manager except printable-stand-sheet */
          body * {
            visibility: hidden !important;
          }
          #printable-stand-sheet,
          #printable-stand-sheet * {
            visibility: visible !important;
          }
          #printable-stand-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Screen View: Header & Quick Actions */}
      <div className="no-print space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <QrCode className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                Table QR Codes &amp; Acrylic Stand Cards
              </h2>
            </div>
            <p className="text-xs text-stone-400">
              Print-ready 4x6 inch acrylic stand cards on A4 sheets, and copyable URLs for NFC tag programming.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyAll}
              className="py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white font-bold text-xs flex items-center gap-2 border border-stone-800 transition cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied All URLs!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-stone-400" />
                  <span>Copy All NFC URLs</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print 4x6 Stand Cards (A4)</span>
            </button>
          </div>
        </div>

        {/* NFC Setup Guidance Note (As explicitly required) */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900 to-blue-950/40 border border-blue-500/30 shadow-md">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 text-xs text-stone-300">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>NFC Tag Programming Guidance</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Important
                </span>
              </h3>
              <p className="text-stone-300 leading-relaxed">
                When writing table URLs to NFC tags (e.g. NTAG213 / NTAG215 stickers under acrylic stands using apps like <em>NFC Tools</em>):
              </p>
              <ul className="list-disc list-inside space-y-1 text-stone-400 pt-1">
                <li>
                  <strong className="text-amber-300">Password-Protect for Writing:</strong> Set a write password (e.g., a 4-digit PIN) so visitors cannot overwrite or tamper with the tag url.
                </li>
                <li>
                  <strong className="text-emerald-300">Read Access Stays Open:</strong> Read access must remain completely open so any customer tapping with an iPhone or Android phone opens the table menu instantly without needing any app.
                </li>
                <li>
                  <strong className="text-red-300">NEVER Permanently Lock:</strong> Never check &quot;Permanent Lock / OTP Lock&quot;. Keeping it password-protected allows you to reassign or rewrite tags if table numbers or domains ever change.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Table Selector & NFC URL Copyable List */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span>NFC Tag Writing URLs ({tables.length} Tables)</span>
              </h3>
              <p className="text-xs text-stone-400">
                Copy individual URLs to write each table&apos;s NFC tag sticker or view standalone QR codes.
              </p>
            </div>

            {/* Filter by Table */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-400">Show on Screen:</span>
              <select
                value={selectedTableId}
                onChange={e => setSelectedTableId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold focus:outline-hidden focus:border-amber-500"
              >
                <option value="ALL">All Tables ({tables.length})</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.table_number} ({t.table_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tables.map(table => {
              const url = `${cleanDomain}/t/${table.table_code.toLowerCase()}`;
              const isCopied = copiedId === table.id;

              return (
                <div
                  key={table.id}
                  className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3 text-xs hover:border-stone-700 transition"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">
                      {table.table_number}
                    </span>
                    <span className="text-[11px] font-mono text-amber-400/80 truncate block">
                      {url}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(table)}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition cursor-pointer"
                      title="Copy URL for NFC Tag"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadPNG(table)}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 transition cursor-pointer"
                      title="Download QR PNG"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition cursor-pointer"
                      title="Open Table URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Title for Stand Cards */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>4x6 Inch Acrylic Stand Print Preview</span>
            </h3>
            <p className="text-xs text-stone-400">
              Each card is formatted to standard 4x6 inches (102 x 152 mm) with light cutting guide lines. Two cards fit per A4 page.
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Stand Cards</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PRINT-FRIENDLY 4x6 INCH CARDS CONTAINER                 */}
      {/* Fits standard A4 sheet in portrait mode                  */}
      {/* ======================================================== */}
      <div
        id="printable-stand-sheet"
        className="flex flex-wrap items-center justify-center gap-6 p-2 sm:p-4 bg-stone-950 sm:bg-stone-900/40 rounded-3xl border border-stone-800/80"
      >
        {tablesToDisplay.map(table => {
          const qrDataUrl = qrMap[table.id];
          const url = `${cleanDomain}/t/${table.table_code.toLowerCase()}`;

          return (
            <div
              key={table.id}
              className="acrylic-card bg-white text-stone-900 shadow-2xl rounded-2xl flex flex-col justify-between items-center text-center p-5 border-2 border-dashed border-stone-300 relative select-none"
              style={{
                width: '101.6mm',
                height: '152.4mm',
                maxWidth: '100%',
                boxSizing: 'border-box',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
              }}
            >
              {/* Cutting guide badge (hidden on actual acrylic, subtle for scissor cut) */}
              <div className="absolute top-1.5 left-2 right-2 flex justify-between items-center text-[8px] text-stone-400 uppercase font-mono tracking-widest pointer-events-none">
                <span>✂ 4x6 Stand Card</span>
                <span>102 x 152 mm</span>
              </div>

              {/* Card Header: Cafe Identity */}
              <div className="w-full pt-2">
                <div className="flex items-center justify-center gap-1.5 text-amber-700 font-extrabold text-[12px] uppercase tracking-wider">
                  <span className="text-sm">☕</span>
                  <span>{settings.cafe_name || 'Brew & Bites Cafe'}</span>
                </div>
                {settings.cafe_tagline && !settings.cafe_tagline.startsWith('{') && (
                  <p className="text-[9px] text-stone-500 tracking-wide mt-0.5">
                    {settings.cafe_tagline}
                  </p>
                )}
              </div>

              {/* Large Table Number (As required: "table number in large text") */}
              <div className="my-1">
                <div className="inline-block px-5 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 block">
                    SEATING
                  </span>
                  <h1 className="text-3xl font-black text-stone-950 tracking-tight leading-none">
                    {table.table_number.toUpperCase()}
                  </h1>
                </div>
              </div>

              {/* Center: High-Resolution QR Code */}
              <div className="my-1 p-2.5 rounded-2xl bg-stone-50 border border-stone-200 shadow-inner">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`QR Code for ${table.table_number}`}
                    className="w-36 h-36 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-stone-400 font-mono text-xs">
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Bilingual Instructions: English and Hindi (As required: "Scan or tap to order in Hindi and English") */}
              <div className="w-full space-y-1 my-1">
                {/* English */}
                <div className="flex items-center justify-center gap-1.5 text-stone-950 font-black text-xs sm:text-sm tracking-tight">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Scan or tap to order</span>
                </div>

                {/* Hindi */}
                <div className="text-[11px] font-bold text-amber-800">
                  ऑर्डर करने के लिए स्कैन या टैप करें
                </div>

                {/* NFC Indicator Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-[9px] font-bold text-stone-600 font-mono">
                  <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                  <span>NFC TAP ENABLED</span>
                </div>
              </div>

              {/* Card Footer: Table URL */}
              <div className="w-full pt-1 border-t border-stone-200/60 text-[9px] font-mono text-stone-400 truncate">
                {url}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
