'use client';

import React, { useState, useEffect } from 'react';
import { Category } from '@/types/database';
import { apiUrl } from '@/lib/base-path';
import { X, Layers, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  category: Category | null; // null for new category, non-null for edit
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryModal({ isOpen, category, onClose, onSaved }: Props) {
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (category) {
      setNameEn(category.name_en);
      setNameHi(category.name_hi);
      setDisplayOrder(category.display_order || 1);
    } else {
      setNameEn('');
      setNameHi('');
      setDisplayOrder(1);
    }
    setErrorMsg('');
  }, [category, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameEn.trim() || !nameHi.trim()) {
      setErrorMsg('Both English and Hindi category names are required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const isEdit = !!category;
      const res = await fetch(apiUrl('/api/manager/categories'), {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: category?.id,
          name_en: nameEn.trim(),
          name_hi: nameHi.trim(),
          display_order: Number(displayOrder) || 1,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to save category.');
      }
    } catch {
      setErrorMsg('Network error while saving category.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl space-y-4 animate-slide-up sm:animate-scale-up"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {category ? 'Edit Category' : 'Add New Category'}
              </h3>
              <p className="text-[11px] text-stone-400">
                Organize menu items with bilingual labels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Category Name (English)
            </label>
            <input
              type="text"
              required
              value={nameEn}
              onChange={e => setNameEn(e.target.value)}
              placeholder="e.g. Hot Coffees, South Indian Snacks"
              className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Category Name (हिन्दी)
            </label>
            <input
              type="text"
              required
              value={nameHi}
              onChange={e => setNameHi(e.target.value)}
              placeholder="e.g. गरमा गरम कॉफ़ी, दक्षिण भारतीय नाश्ता"
              className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Sort Order (Display Sequence)
            </label>
            <input
              type="number"
              min={1}
              value={displayOrder}
              onChange={e => setDisplayOrder(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono"
            />
            <p className="text-[10px] text-stone-500 mt-1">
              Lower numbers appear first in the customer menu category chips.
            </p>
          </div>

          <div className="flex gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{category ? 'Save Changes' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
