'use client';

import React from 'react';
import { Clock, Flame, BellRing, CheckCircle2, Ban } from 'lucide-react';
import { OrderStatus } from '@/types/database';

interface Props {
  status: OrderStatus | string;
  language?: 'en' | 'hi';
  compact?: boolean;
}

const STEPS = [
  { key: 'PENDING', en: 'Received', hi: 'प्राप्त', Icon: Clock },
  { key: 'PREPARING', en: 'Preparing', hi: 'बन रहा है', Icon: Flame },
  { key: 'READY', en: 'Ready', hi: 'तैयार', Icon: BellRing },
  { key: 'SERVED', en: 'Served', hi: 'परोसा गया', Icon: CheckCircle2 },
] as const;

const STEP_INDEX: Record<string, number> = {
  PENDING: 0,
  PREPARING: 1,
  READY: 2,
  SERVED: 3,
  BILLED: 3,
};

/**
 * Live 4-step kitchen progress tracker displayed on customer order cards.
 * Animates active step pulse and progressive fill bar across stages.
 */
export function OrderStatusStepper({ status, language = 'en', compact = false }: Props) {
  if (status === 'CANCELLED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
        <Ban className="w-3 h-3" />
        <span>{language === 'hi' ? 'रद्द किया गया' : 'Cancelled'}</span>
      </div>
    );
  }

  const activeIdx = STEP_INDEX[status] ?? 0;
  const progressPercent = (activeIdx / (STEPS.length - 1)) * 100;

  return (
    <div className={`w-full ${compact ? 'pt-1 pb-0.5' : 'pt-2 pb-1'}`}>
      <div className="relative flex items-center justify-between">
        {/* Background track */}
        <div className="absolute left-3 right-3 top-3.5 h-1 bg-stone-200/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              activeIdx === 3
                ? 'bg-emerald-500'
                : activeIdx === 2
                ? 'bg-blue-500'
                : 'bg-linear-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isCompleted = idx < activeIdx || (idx === 3 && activeIdx === 3);
          const isCurrent = idx === activeIdx && activeIdx < 3;
          const Icon = step.Icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                  isCurrent
                    ? step.key === 'READY'
                      ? 'bg-blue-600 border-blue-200 text-white shadow-md shadow-blue-500/30 scale-110 ring-4 ring-blue-500/15'
                      : step.key === 'PREPARING'
                      ? 'bg-orange-500 border-orange-200 text-white shadow-md shadow-orange-500/30 scale-110 ring-4 ring-orange-500/15'
                      : 'bg-amber-500 border-amber-200 text-white shadow-md shadow-amber-500/30 scale-110 ring-4 ring-amber-500/15'
                    : isCompleted
                    ? activeIdx === 3
                      ? 'bg-emerald-500 border-emerald-200 text-white'
                      : 'bg-amber-500 border-amber-200 text-white'
                    : 'bg-white border-stone-200 text-stone-300'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isCurrent && step.key === 'PREPARING'
                      ? 'animate-pulse'
                      : isCurrent && step.key === 'READY'
                      ? 'animate-bounce'
                      : ''
                  }`}
                />
              </div>

              <span
                className={`text-[10px] font-bold tracking-tight whitespace-nowrap transition-colors ${
                  isCurrent
                    ? step.key === 'READY'
                      ? 'text-blue-700 font-extrabold'
                      : step.key === 'PREPARING'
                      ? 'text-orange-700 font-extrabold'
                      : 'text-amber-800 font-extrabold'
                    : isCompleted
                    ? activeIdx === 3
                      ? 'text-emerald-700'
                      : 'text-stone-700'
                    : 'text-stone-400 font-medium'
                }`}
              >
                {language === 'hi' ? step.hi : step.en}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
