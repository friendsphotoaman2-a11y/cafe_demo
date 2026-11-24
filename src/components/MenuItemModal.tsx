'use client';

import React, { useState, useEffect } from 'react';
import { MenuItem, Category, MealTiming } from '@/types/database';
import { uploadMenuImageToStorage, compressMenuImage } from '@/lib/image-compress';
import { apiUrl } from '@/lib/base-path';
import { X, Upload, Loader2, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import Image from 'next/image';

interface Props {
  isOpen: boolean;
  item: MenuItem | null; // null for add, non-null for edit
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function MenuItemModal({ isOpen, item, categories, onClose, onSaved }: Props) {
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionHi, setDescriptionHi] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [isVeg, setIsVeg] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [mealTiming, setMealTiming] = useState<MealTiming>('all_day');
  const [breakfastStart, setBreakfastStart] = useState('07:00:00');
  const [breakfastEnd, setBreakfastEnd] = useState('11:30:00');
  const [lunchStart, setLunchStart] = useState('12:00:00');
  const [lunchEnd, setLunchEnd] = useState('16:00:00');

  // Image Upload state
  const [compressing, setCompressing] = useState(false);
  const [uploadStats, setUploadStats] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (item) {
      setNameEn(item.name_en);
      setNameHi(item.name_hi);
      setDescriptionEn(item.description_en || '');
      setDescriptionHi(item.description_hi || '');
      setCategoryId(item.category_id || (categories[0]?.id || ''));
      setPrice(item.price);
      setIsVeg(item.is_veg);
      setImageUrl(item.image_url || '');
      setMealTiming(item.meal_timing || 'all_day');
      setBreakfastStart(item.breakfast_start || '07:00:00');
      setBreakfastEnd(item.breakfast_end || '11:30:00');
      setLunchStart(item.lunch_start || '12:00:00');
      setLunchEnd(item.lunch_end || '16:00:00');
      setUploadStats(item.image_url ? 'Existing image' : null);
    } else {
      setNameEn('');
      setNameHi('');
      setDescriptionEn('');
      setDescriptionHi('');
      setCategoryId(categories[0]?.id || '');
      setPrice('');
      setIsVeg(true);
      setImageUrl('');
      setMealTiming('all_day');
      setBreakfastStart('07:00:00');
      setBreakfastEnd('11:30:00');
      setLunchStart('12:00:00');
      setLunchEnd('16:00:00');
      setUploadStats(null);
    }
    setErrorMsg('');
  }, [item, categories, isOpen]);

  if (!isOpen) return null;

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setErrorMsg('');
    setUploadStats('Compressing to ~800px WebP (<150 KB)...');

    try {
      // 1. Client-side compression
      const { sizeKB } = await compressMenuImage(file);
      setUploadStats(`Compressed (${sizeKB} KB, WebP). Uploading to Supabase Storage...`);

      // 2. Upload to Supabase Storage bucket 'menu-images'
      const publicUrl = await uploadMenuImageToStorage(file);
      setImageUrl(publicUrl);
      setUploadStats(`Uploaded: ${sizeKB} KB (WebP, optimized)`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Photo compression or upload failed.');
      setUploadStats(null);
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameEn.trim() || !nameHi.trim() || price === '' || Number(price) <= 0) {
      setErrorMsg('English name, Hindi name, and valid price in ₹ are required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const isEdit = !!item;
      const res = await fetch(apiUrl('/api/manager/items'), {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item?.id,
          name_en: nameEn.trim(),
          name_hi: nameHi.trim(),
          description_en: descriptionEn.trim() || null,
          description_hi: descriptionHi.trim() || null,
          category_id: categoryId || null,
          price: Number(price),
          is_veg: isVeg,
          image_url: imageUrl || null,
          meal_timing: mealTiming,
          breakfast_start: breakfastStart,
          breakfast_end: breakfastEnd,
          lunch_start: lunchStart,
          lunch_end: lunchEnd,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to save dish.');
      }
    } catch {
      setErrorMsg('Network error while saving dish.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {item ? 'Edit Menu Item' : 'Add New Dish'}
              </h3>
              <p className="text-[11px] text-stone-400">
                Bilingual dish names, pricing, meal windows &amp; photo.
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Dish Names: English and Hindi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Dish Name (English) *
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Masala Dosa"
                className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Dish Name (हिन्दी) *
              </label>
              <input
                type="text"
                required
                value={nameHi}
                onChange={e => setNameHi(e.target.value)}
                placeholder="e.g. मसाला डोसा"
                className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500"
              >
                <option value="">Uncategorized</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_en} ({cat.name_hi})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-300 mb-1">Price (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Veg / Non-Veg Toggle */}
          <div>
            <label className="block font-semibold text-stone-300 mb-1.5">Dietary Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsVeg(true)}
                className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                  isVeg
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-stone-800 bg-stone-800/40 text-stone-400'
                }`}
              >
                <span className="w-3.5 h-3.5 border-2 border-emerald-500 rounded-sm flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </span>
                <span>Vegetarian</span>
              </button>

              <button
                type="button"
                onClick={() => setIsVeg(false)}
                className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                  !isVeg
                    ? 'border-red-500 bg-red-500/20 text-red-300'
                    : 'border-stone-800 bg-stone-800/40 text-stone-400'
                }`}
              >
                <span className="w-3.5 h-3.5 border-2 border-red-500 rounded-sm flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </span>
                <span>Non-Vegetarian</span>
              </button>
            </div>
          </div>

          {/* Meal Timing Window (Breakfast/Lunch/All Day) */}
          <div>
            <label className="block font-semibold text-stone-300 mb-1.5">
              Available Time Window (Asia/Kolkata)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['all_day', 'breakfast', 'lunch'] as const).map(timing => (
                <button
                  key={timing}
                  type="button"
                  onClick={() => setMealTiming(timing)}
                  className={`py-2 px-3 rounded-xl border capitalize font-bold transition cursor-pointer ${
                    mealTiming === timing
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-stone-800 bg-stone-800/40 text-stone-400'
                  }`}
                >
                  {timing === 'all_day'
                    ? 'All Day'
                    : timing === 'breakfast'
                    ? 'Breakfast'
                    : 'Lunch'}
                </button>
              ))}
            </div>

            {mealTiming === 'breakfast' && (
              <div className="mt-2 p-2.5 bg-stone-800/50 rounded-xl border border-stone-700/60 flex items-center justify-between text-[11px] text-stone-300">
                <span>Breakfast Window:</span>
                <span className="font-mono text-amber-300 font-bold">
                  {breakfastStart.slice(0, 5)} - {breakfastEnd.slice(0, 5)}
                </span>
              </div>
            )}

            {mealTiming === 'lunch' && (
              <div className="mt-2 p-2.5 bg-stone-800/50 rounded-xl border border-stone-700/60 flex items-center justify-between text-[11px] text-stone-300">
                <span>Lunch Window:</span>
                <span className="font-mono text-amber-300 font-bold">
                  {lunchStart.slice(0, 5)} - {lunchEnd.slice(0, 5)}
                </span>
              </div>
            )}
          </div>

          {/* Photo Upload with Client-Side Compression */}
          <div>
            <label className="block font-semibold text-stone-300 mb-1.5">
              Dish Photo (Compressed to ~800px WebP, &lt;150 KB)
            </label>

            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-amber-900/40 shrink-0 bg-stone-800">
                  <Image
                    src={imageUrl}
                    alt="Preview"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-500 shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              <div className="flex-1">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold cursor-pointer border border-stone-700 transition">
                  {compressing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Upload className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{compressing ? 'Optimizing...' : 'Upload & Compress Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageFileChange}
                    disabled={compressing}
                    className="hidden"
                  />
                </label>

                {uploadStats && (
                  <p className="text-[10px] text-emerald-400 mt-1 font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{uploadStats}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || compressing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{item ? 'Save Dish' : 'Create Dish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
