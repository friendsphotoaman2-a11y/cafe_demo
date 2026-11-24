'use client';

import React from 'react';
import { Order } from '@/types/database';
import { TableOrdersFeed } from '@/components/TableOrdersFeed';
import { useTranslation } from '@/lib/i18n';
import { X, ClipboardList } from 'lucide-react';

interface Props {
  orders: Order[];
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  taxEnabled?: boolean;
  gstRatePercent?: number;
}

/**
 * Quick bottom-sheet drawer displaying live shared table orders with 4-step kitchen tracking.
 */
export function LiveOrderList({
  orders,
  deviceId,
  isOpen,
  onClose,
  tableNumber,
  taxEnabled = true,
  gstRatePercent = 5.0,
}: Props) {
  const { language } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] rounded-t-[28px] sm:rounded-3xl bg-[#faf7f2] shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-amber-200/30"
      >
        {/* Drag Handle (Mobile UX cue) */}
        <div className="sm:hidden bg-stone-900 pt-2.5 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-stone-700" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 bg-stone-900 text-white flex items-center justify-between border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                <span>{language === 'hi' ? 'टेबल गतिविधि' : 'Live Table Activity'}</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </h3>
              <p className="text-[11px] text-stone-400 font-medium">
                {tableNumber} • {language === 'hi' ? 'साझा लाइव दृश्य' : 'Shared Live View'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feed Body */}
        <div className="p-4 overflow-y-auto flex-1">
          <TableOrdersFeed
            orders={orders}
            deviceId={deviceId}
            language={language}
            taxEnabled={taxEnabled}
            gstRatePercent={gstRatePercent}
            onBrowseMenu={onClose}
          />
        </div>
      </div>
    </div>
  );
}
