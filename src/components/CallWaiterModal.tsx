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
    { id: 'Water', en: 'Water', hi: 'पानी (Water)' },
    { id: 'Bill', en: 'Bill', hi: 'बिल (Bill)' },
    { id: 'Help', en: 'Help', hi: 'मदद (Help)' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setIsCooldown(false);

    try {
      const res = await fetch(apiUrl('/api/table/call-waiter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_token: sessionToken,
          note: note.trim().slice(0, 100) || undefined,
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
          language === 'hi' ? 'वेटर आपकी टेबल की तरफ आ रहा है' : 'Waiter is on the way'
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
    if (note === chipText) {
      setNote('');
    } else {
      setNote(chipText);
    }
    setErrorMsg('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-amber-100 flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                {language === 'hi' ? 'वेटर को बुलाएं' : 'Call Waiter'}
              </h3>
              <p className="text-[11px] text-amber-700 font-semibold">{tableNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {success ? (
          <div className="py-8 text-center flex flex-col items-center animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-black text-base text-gray-900">{successMessage}</h4>
            <p className="text-xs text-gray-500 mt-1">
              {language === 'hi'
                ? 'स्टाफ को आपकी टेबल का संदेश मिल गया है।'
                : 'Staff has received your call and is approaching your table.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Quick Chips: Water, Bill, Help */}
            <div>
              <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                {language === 'hi' ? 'त्वरित विकल्प' : 'Quick Options'}
              </span>
              <div className="flex flex-wrap gap-2">
                {quickChips.map(chip => {
                  const label = language === 'hi' ? chip.hi : chip.en;
                  const isSelected = note === chip.en || note === chip.hi;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleSelectChip(language === 'hi' ? chip.hi : chip.en)}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all shadow-2xs cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs scale-105'
                          : 'bg-amber-50/80 text-amber-900 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Note Field (Max 100 characters) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  {language === 'hi' ? 'वैकल्पिक संदेश (अधिकतम 100 शब्द)' : 'Optional Note (max 100 chars)'}
                </label>
                <span className="text-[10px] text-gray-400 font-mono">
                  {note.length}/100
                </span>
              </div>
              <textarea
                value={note}
                maxLength={100}
                onChange={e => {
                  setNote(e.target.value.slice(0, 100));
                  setErrorMsg('');
                }}
                placeholder={
                  language === 'hi'
                    ? 'जैसे: पानी के दो ग्लास, चम्मच, या बिल...'
                    : 'e.g. Extra glasses of water, cutlery, or bill...'
                }
                rows={2}
                className="w-full rounded-2xl border border-gray-200 p-3 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:border-amber-500 focus:outline-hidden shadow-2xs resize-none"
              />
            </div>

            {/* Error / Cooldown Alert */}
            {errorMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
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

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'वेटर बुलाएं' : 'Call Waiter'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
