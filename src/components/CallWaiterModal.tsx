'use client';

import React, { useState } from 'react';
import { apiUrl } from '@/lib/base-path';
import { Bell, X, CheckCircle2, Loader2, Sparkles, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
  sessionId?: string | null;
  tableNumber: string;
}

/**
 * Centered interactive Call Waiter dialog with sonar pulse animation, haptic feedback,
 * optional quick-request chips, and animated confirmation view.
 */
export function CallWaiterModal({
  isOpen,
  onClose,
  sessionToken,
  sessionId,
  tableNumber,
}: Props) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Waiter is on the way');
  const [errorMsg, setErrorMsg] = useState('');
  const [isCooldown, setIsCooldown] = useState(false);
  const { language } = useTranslation();

  if (!isOpen) return null;

  const quickChips = [
    { id: 'Water', en: 'Water', hi: 'पानी' },
    { id: 'Bill', en: 'Bill', hi: 'बिल' },
    { id: 'Help', en: 'Cutlery / Napkins', hi: 'चम्मच / नैपकिन' },
  ];

  const triggerHaptic = (ms: number | number[] = 40) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  async function handleCallWaiter(customNote?: string) {
    triggerHaptic(50);
    setLoading(true);
    setErrorMsg('');
    setIsCooldown(false);

    const finalNote = customNote !== undefined ? customNote : note;

    try {
      const res = await fetch(apiUrl('/api/table/call-waiter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_token: sessionToken,
          note: finalNote.trim().slice(0, 100) || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.cooldown) {
          setIsCooldown(true);
          setErrorMsg(
            language === 'hi'
              ? `वेटर को पहले ही सूचित किया जा चुका है! कृपया ${data.remaining_seconds || 30} सेकंड बाद दोबारा कॉल करें।`
              : data.message || 'Staff was already notified! Please wait a moment before calling again.'
          );
        } else {
          setErrorMsg(
            language === 'hi'
              ? 'वेटर को अलर्ट नहीं किया जा सका। कृपया पुनः प्रयास करें।'
              : data.message || 'Failed to alert staff. Please try again.'
          );
        }
      } else {
        triggerHaptic([60, 40, 90]);
        setSuccess(true);
        setSuccessMessage(
          language === 'hi' ? 'वेटर आपकी टेबल की तरफ आ रहा है!' : 'Waiter is on the way!'
        );
        setTimeout(() => {
          setSuccess(false);
          setNote('');
          setErrorMsg('');
          onClose();
        }, 2200);
      }
    } catch {
      setErrorMsg(
        language === 'hi'
          ? 'नेटवर्क त्रुटि। कृपया सीधे वेटर को बुलाएं।'
          : 'Network error. Please wave down staff directly.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSelectChip(chipText: string) {
    triggerHaptic(25);
    setNote(prev => (prev === chipText ? '' : chipText));
    setErrorMsg('');
  }

  return (
    <div
      onClick={() => !loading && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in select-none"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-[32px] bg-linear-to-b from-[#fffdf9] to-white p-6 shadow-2xl border border-amber-200/60 flex flex-col items-center text-center relative animate-scale-up overflow-hidden"
      >
        {/* Subtle warm top accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-amber-400 via-orange-500 to-amber-500" />

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 active:scale-90 transition cursor-pointer disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Table Badge & Title */}
        <div className="mb-1 pt-1">
          <span className="px-3 py-1 rounded-full bg-amber-100/90 text-amber-950 text-xs font-extrabold inline-block mb-2 border border-amber-200">
            {tableNumber}
          </span>
          <h3 className="font-black text-xl text-stone-900 tracking-tight">
            {language === 'hi' ? 'वेटर को बुलाएं' : 'Call Waiter'}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5 font-medium">
            {language === 'hi'
              ? 'तुरंत अलर्ट भेजने के लिए घंटी दबाएं'
              : 'Tap the bell to instantly alert your server'}
          </p>
        </div>

        {/* Success View */}
        {success ? (
          <div className="py-7 text-center flex flex-col items-center animate-scale-up">
            <div className="relative mb-4">
              <span className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-linear-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-11 h-11" />
              </div>
            </div>
            <h4 className="font-black text-lg text-stone-900">{successMessage}</h4>
            <p className="text-xs text-stone-500 mt-1.5 max-w-[240px] leading-relaxed">
              {language === 'hi'
                ? 'स्टाफ को आपकी टेबल का संदेश मिल गया है और वे पहुंच रहे हैं।'
                : 'Our staff has received your alert and is heading to your table.'}
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* BIG CIRCULAR RING BUTTON */}
            <div className="relative flex items-center justify-center my-6">
              {/* Pulsing ambient sonar rings */}
              <span className="absolute w-36 h-36 rounded-full bg-amber-400/25 animate-ping pointer-events-none" />
              <span className="absolute w-44 h-44 rounded-full border border-amber-300/40 pointer-events-none" />

              <button
                type="button"
                disabled={loading}
                onClick={() => handleCallWaiter()}
                className="relative z-10 w-32 h-32 rounded-full bg-linear-to-tr from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-90 text-white shadow-[0_12px_30px_-4px_rgba(245,158,11,0.55),inset_0_-4px_8px_rgba(0,0,0,0.15)] border-4 border-white flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                ) : (
                  <>
                    <Bell className="w-10 h-10 animate-bounce text-white drop-shadow-sm" />
                    <span className="font-black text-xs uppercase tracking-wider text-white">
                      {language === 'hi' ? 'दबाएं' : 'Ring Bell'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Error / Cooldown Alert */}
            {errorMsg && (
              <div
                className={`w-full p-3 mb-3 rounded-2xl text-xs font-semibold flex items-start gap-2 text-left animate-shake ${
                  isCooldown
                    ? 'bg-orange-50 border border-orange-200 text-orange-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {isCooldown ? (
                  <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Optional Quick Chips */}
            <div className="w-full pt-3 border-t border-stone-100">
              <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider block mb-2.5">
                {language === 'hi' ? 'त्वरित अनुरोध (वैकल्पिक)' : 'Optional Quick Note'}
              </span>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {quickChips.map(chip => {
                  const label = language === 'hi' ? chip.hi : chip.en;
                  const isSelected = note === chip.en || note === chip.hi;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleSelectChip(label)}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-amber-400 shadow-sm scale-105'
                          : 'bg-stone-100 text-stone-700 hover:bg-amber-50 hover:text-amber-900 border border-stone-200/70'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
