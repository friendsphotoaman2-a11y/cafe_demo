'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CafeTable } from '@/types/database';
import { QrCode, Printer, X, Download } from 'lucide-react';
import { withBasePathUrl } from '@/lib/base-path';

interface Props {
  table: CafeTable | null;
  isOpen: boolean;
  onClose: () => void;
  cafeName: string;
}

export function TableQRCodeModal({ table, isOpen, onClose, cafeName }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [tableUrl, setTableUrl] = useState<string>('');

  useEffect(() => {
    if (!table || !isOpen) return;

    const baseUrl =
      process.env.NEXT_PUBLIC_ORDERING_BASE_URL ||
      (typeof window !== 'undefined'
        ? withBasePathUrl(window.location.origin)
        : 'https://www.thebusinesswork.com/demo/cafe');
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/t/${table.table_code.toLowerCase()}`;
    setTableUrl(url);

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [table, isOpen]);

  if (!isOpen || !table) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card */}
        <div id="printable-qr-card" className="p-4 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/40 my-2">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest block mb-1">
            {cafeName}
          </span>
          <h2 className="text-2xl font-black text-gray-900 mb-1">{table.table_number}</h2>
          <p className="text-xs text-gray-500 mb-4">
            Scan QR Code or Tap NFC Tag to Order
          </p>

          <div className="bg-white p-3 rounded-2xl shadow-sm inline-block border border-gray-100">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR for ${table.table_number}`} className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-gray-300">
                <QrCode className="w-12 h-12 animate-pulse" />
              </div>
            )}
          </div>

          <div className="mt-3">
            <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-full border text-gray-700 inline-block">
              Code: {table.table_code}
            </span>
          </div>

          <p className="text-[10px] text-gray-400 mt-2">
            Ask manager for the 4-digit PIN to unlock menu
          </p>
        </div>

        <p className="text-xs text-gray-500 break-all px-2 mt-2 font-mono">
          {tableUrl}
        </p>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee</span>
          </button>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`${table.table_code}-qr.png`}
              className="py-2.5 px-4 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>PNG</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
