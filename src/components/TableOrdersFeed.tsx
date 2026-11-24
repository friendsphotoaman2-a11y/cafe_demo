'use client';

import React, { useMemo } from 'react';
import { Order } from '@/types/database';
import { OrderStatusStepper } from '@/components/OrderStatusStepper';
import {
  UtensilsCrossed,
  Clock,
  Flame,
  BellRing,
  CheckCircle2,
  Receipt,
  Sparkles,
  Smartphone,
  Users,
} from 'lucide-react';

interface Props {
  orders: Order[];
  deviceId: string;
  language?: 'en' | 'hi';
  taxEnabled?: boolean;
  gstRatePercent?: number;
  onBrowseMenu?: () => void;
}

const STATUS_STYLE: Record<string, { badge: string; en: string; hi: string; Icon: typeof Clock }> = {
  PENDING: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    en: 'Received',
    hi: 'प्राप्त हुआ',
    Icon: Clock,
  },
  PREPARING: {
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    en: 'Preparing',
    hi: 'तैयार हो रहा है',
    Icon: Flame,
  },
  READY: {
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    en: 'Ready to Serve',
    hi: 'परोसने के लिए तैयार',
    Icon: BellRing,
  },
  SERVED: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    en: 'Served',
    hi: 'परोसा गया',
    Icon: CheckCircle2,
  },
};

function renderStatusPill(status: string, language: 'en' | 'hi') {
  const cfg = STATUS_STYLE[status];
  if (!cfg) {
    return (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
        {status}
      </span>
    );
  }
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}
    >
      <Icon className={`w-3 h-3 ${status === 'PREPARING' ? 'animate-pulse' : status === 'READY' ? 'animate-bounce' : ''}`} />
      <span>{language === 'hi' ? cfg.hi : cfg.en}</span>
    </span>
  );
}

/**
 * Shared live table orders feed used in both the customer Orders tab and the Quick Live Orders drawer.
 * Displays a 4-step kitchen progress tracker, cancelled item handling, and table running bill summary.
 */
export function TableOrdersFeed({
  orders,
  deviceId,
  language = 'en',
  taxEnabled = true,
  gstRatePercent = 5.0,
  onBrowseMenu,
}: Props) {
  const myOrders = useMemo(() => orders.filter(o => o.device_id === deviceId), [orders, deviceId]);
  const otherOrders = useMemo(() => orders.filter(o => o.device_id !== deviceId), [orders, deviceId]);

  const totalTableSubtotal = useMemo(() => {
    return orders.reduce((acc, order) => {
      const itemsSum =
        order.order_items?.reduce(
          (sum, it) => (it.status !== 'CANCELLED' ? sum + it.price_per_unit * it.quantity : sum),
          0
        ) || 0;
      return acc + itemsSum;
    }, 0);
  }, [orders]);

  const estimatedTax = taxEnabled
    ? Math.round(((totalTableSubtotal * gstRatePercent) / 100) * 100) / 100
    : 0;
  const estimatedGrandTotal = totalTableSubtotal + estimatedTax;

  if (orders.length === 0) {
    return (
      <div className="py-14 px-6 text-center bg-white rounded-3xl border border-stone-200/80 shadow-xs animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 animate-float">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h3 className="text-base font-black text-stone-900">
          {language === 'hi' ? 'अभी कोई ऑर्डर नहीं है' : 'No orders placed yet'}
        </h3>
        <p className="text-xs text-stone-500 mt-1.5 mb-5 max-w-xs mx-auto leading-relaxed">
          {language === 'hi'
            ? 'मेनू ब्राउज़ करें और अपना पहला ऑर्डर दें — किचन में लाइव स्थिति यहीं दिखेगी।'
            : 'Browse the menu and place your first round — live kitchen tracking updates appear right here.'}
        </p>
        {onBrowseMenu && (
          <button
            type="button"
            onClick={onBrowseMenu}
            className="py-3 px-6 rounded-2xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-amber-500/25 transition cursor-pointer inline-flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'मेनू देखें' : 'Explore Menu'}</span>
          </button>
        )}
      </div>
    );
  }

  const renderOrderCard = (order: Order, isMine: boolean, index: number) => {
    const activeOrderItems = (order.order_items || []).filter(it => it.status !== 'CANCELLED');
    const allCancelled =
      (order.order_items?.length || 0) > 0 && activeOrderItems.length === 0;
    const effectiveStatus = allCancelled ? 'CANCELLED' : order.status;

    const orderSubtotal = activeOrderItems.reduce(
      (sum, it) => sum + it.price_per_unit * it.quantity,
      0
    );

    return (
      <div
        key={order.id}
        style={{ animationDelay: `${Math.min(index * 60, 240)}ms` }}
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all animate-fade-in-up ${
          isMine
            ? 'border-emerald-500/30 bg-linear-to-b from-emerald-50/35 to-white shadow-xs'
            : 'border-stone-200 bg-stone-50/70'
        }`}
      >
        {/* Top Row: Time + Status Pill */}
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-stone-500 bg-white px-2 py-0.5 rounded-lg border border-stone-200/70 font-mono">
              {new Date(order.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {renderStatusPill(effectiveStatus, language)}
        </div>

        {/* Live Kitchen 4-Step Tracker */}
        <div className="mb-3 pb-3 border-b border-stone-200/60">
          <OrderStatusStepper status={effectiveStatus} language={language} compact />
        </div>

        {/* Items Breakdown */}
        <div className="space-y-2">
          {order.order_items?.map(item => {
            const isCancelled = item.status === 'CANCELLED';
            return (
              <div
                key={item.id}
                className={`flex justify-between items-start text-sm ${
                  isCancelled ? 'opacity-50' : ''
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-bold text-stone-800 ${
                        isCancelled ? 'line-through text-stone-400' : ''
                      }`}
                    >
                      {item.quantity}× {language === 'hi' ? item.item_name_hi : item.item_name_en}
                    </span>
                    {isCancelled && (
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                        {language === 'hi' ? 'रद्द' : 'Cancelled'}
                      </span>
                    )}
                  </div>
                  {item.item_notes && !isCancelled && (
                    <p className="text-xs text-amber-800/90 bg-amber-50/80 inline-block px-2 py-0.5 rounded-md mt-1 border border-amber-200/50">
                      {item.item_notes}
                    </p>
                  )}
                </div>
                <span
                  className={`font-extrabold shrink-0 font-mono text-xs sm:text-sm ${
                    isCancelled ? 'line-through text-stone-400' : 'text-stone-900'
                  }`}
                >
                  ₹{isCancelled ? 0 : item.price_per_unit * item.quantity}
                </span>
              </div>
            );
          })}
        </div>

        {/* Per-order subtotal */}
        {!allCancelled && (
          <div className="mt-2.5 pt-2 border-t border-dashed border-stone-200 flex justify-between items-center text-xs text-stone-500 font-semibold">
            <span>{language === 'hi' ? 'राउंड कुल' : 'Round Total'}</span>
            <span className="font-mono font-bold text-stone-800">₹{orderSubtotal}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. "Your Order" Section */}
      <div className="bg-white rounded-3xl border-2 border-emerald-500/25 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-stone-900 leading-tight">
                {language === 'hi' ? 'आपका ऑर्डर' : 'Your Orders'}
              </h3>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{language === 'hi' ? 'यह फोन' : 'This Phone'}</span>
          </span>
        </div>

        {myOrders.length === 0 ? (
          <p className="text-xs text-stone-400 italic bg-stone-50 p-4 rounded-2xl border border-dashed border-stone-200 text-center">
            {language === 'hi'
              ? 'आपने अभी तक इस फोन से कोई आइटम ऑर्डर नहीं किया है।'
              : 'You haven’t placed any orders from this phone yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {myOrders.map((order, idx) => renderOrderCard(order, true, idx))}
          </div>
        )}
      </div>

      {/* 2. "Others at your table" Section */}
      {otherOrders.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-stone-800">
                {language === 'hi' ? 'टेबल के अन्य ऑर्डर' : 'Others at your table'}
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">
              {otherOrders.length}{' '}
              {otherOrders.length > 1
                ? language === 'hi'
                  ? 'ऑर्डर्स'
                  : 'orders'
                : language === 'hi'
                ? 'ऑर्डर'
                : 'order'}
            </span>
          </div>

          <div className="space-y-3">
            {otherOrders.map((order, idx) => renderOrderCard(order, false, idx))}
          </div>
        </div>
      )}

      {/* 3. Running Table Bill & Pay at Counter Summary */}
      <div className="p-4 sm:p-5 bg-white rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
            <span>{language === 'hi' ? 'आइटम योग' : 'Items Subtotal'}</span>
            <span className="font-mono text-stone-800">₹{totalTableSubtotal}</span>
          </div>

          {taxEnabled && (
            <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
              <span>GST ({gstRatePercent}%)</span>
              <span className="font-mono text-emerald-700">+₹{estimatedTax.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-dashed border-stone-200">
            <span className="text-sm font-black text-stone-900">
              {language === 'hi' ? 'टेबल का कुल बिल' : 'Table Running Total'}
            </span>
            <span className="text-xl text-amber-700 font-black font-mono">
              ₹{taxEnabled ? estimatedGrandTotal.toFixed(2) : totalTableSubtotal}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="text-xs leading-snug text-amber-950">
            <p className="font-black">
              {language === 'hi' ? 'काउंटर पर भुगतान' : 'Consolidated Counter Billing'}
            </p>
            <p className="text-[11px] text-amber-900/80 font-medium mt-0.5">
              {language === 'hi'
                ? 'भोजन समाप्त होने पर कृपया काउंटर पर जाकर इस टेबल का कुल बिल दें।'
                : 'No online payment needed now. Simply settle your consolidated table bill at the counter when finished.'}
            </p>
          </div>
        </div>

        {onBrowseMenu && (
          <button
            type="button"
            onClick={onBrowseMenu}
            className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-amber-400 font-extrabold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'कुछ और ऑर्डर करें' : 'Order More Items'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
