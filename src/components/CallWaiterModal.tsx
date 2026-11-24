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

  const triggerHaptic = (ms = 40) => {
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
        setSuccess(true);
        setSuccessMessage(
          language === 'hi' ? 'वेटर आपकी टेबल की तरफ आ रहा है!' : 'Waiter has been alerted!'
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
    if (note === chipText) {
      setNote('');
    } else {
      setNote(chipText);
    }
    setErrorMsg('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl border border-amber-100 flex flex-col items-center text-center relative animate-scale-up">
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Table Badge & Title */}
        <div className="mb-2">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold inline-block mb-1 border border-amber-200/80">
            {tableNumber}
          </span>
          <h3 className="font-black text-xl text-gray-900 tracking-tight">
            {language === 'hi' ? 'वेटर को बुलाएं' : 'Call Server'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {language === 'hi'
              ? 'तुरंत अलर्ट भेजने के लिए नीचे बटन दबाएं'
              : 'Press the bell to instantly alert your server'}
          </p>
        </div>

        {/* Success View */}
        {success ? (
          <div className="py-6 text-center flex flex-col items-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h4 className="font-black text-lg text-gray-900">{successMessage}</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
              {language === 'hi'
                ? 'स्टाफ को आपकी टेबल का संदेश मिल गया है और वे पहुंच रहे हैं।'
                : 'Staff has received your notification and is approaching your table.'}
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* BIG CIRCULAR RING BUTTON */}
            <div className="relative flex items-center justify-center my-5">
              {/* Pulsing ambient rings */}
              <span className="absolute w-36 h-36 rounded-full bg-amber-400/25 animate-ping pointer-events-none" />
              <span className="absolute w-40 h-40 rounded-full border-2 border-amber-300/40 pointer-events-none" />

              <button
                type="button"
                disabled={loading}
                onClick={() => handleCallWaiter()}
                className="relative z-10 w-32 h-32 rounded-full bg-linear-to-tr from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-90 text-white shadow-xl shadow-amber-500/40 border-4 border-white flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                ) : (
                  <>
                    <Bell className="w-10 h-10 animate-bounce text-white drop-shadow-sm" />
                    <span className="font-black text-xs uppercase tracking-wider text-white">
                      {language === 'hi' ? 'दबाएं' : 'Press'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Error / Cooldown Alert */}
            {errorMsg && (
              <div
                className={`w-full p-2.5 mb-3 rounded-xl text-xs font-semibold flex items-start gap-2 text-left ${
                  isCooldown
                    ? 'bg-orange-50 border border-orange-200 text-orange-800'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}
              >
                {isCooldown ? (
                  <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Optional Quick Chips */}
            <div className="w-full pt-2 border-t border-gray-100">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block mb-2">
                {language === 'hi' ? 'त्वरित कारण (वैकल्पिक)' : 'Optional Note'}
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
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-amber-50 hover:text-amber-900 border border-gray-200/60'
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
