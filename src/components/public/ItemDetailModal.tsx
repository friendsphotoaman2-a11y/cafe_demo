"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  MenuItem,
  CustomizationOption,
  OrderCustomizationChoice,
} from "@/lib/types";
import { formatINR } from "@/lib/utils";
import {
  X,
  Plus,
  Minus,
  Flame,
  Thermometer,
  ShieldAlert,
  Sparkles,
  ShoppingBag,
  Check,
} from "lucide-react";

interface ItemDetailModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (
    item: MenuItem,
    quantity: number,
    selectedCustomizations: OrderCustomizationChoice[]
  ) => void;
  isTableMode?: boolean;
}

export default function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  isTableMode = false,
}: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, CustomizationOption>
  >({});
  const [addedToast, setAddedToast] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setAddedToast(false);
      // Preselect default first options for required groups
      const defaults: Record<string, CustomizationOption> = {};
      item.customizationGroups?.forEach((group) => {
        if (group.options.length > 0) {
          defaults[group.id] = group.options[0];
        }
      });
      setSelectedOptions(defaults);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  // Calculate total unit price including options
  const optionDeltas = Object.values(selectedOptions).reduce(
    (acc, opt) => acc + opt.priceDelta,
    0
  );
  const unitPrice = item.price + optionDeltas;
  const totalPrice = unitPrice * quantity;

  const handleOptionChange = (groupId: string, option: CustomizationOption) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: option,
    }));
  };

  const handleAdd = () => {
    const choices: OrderCustomizationChoice[] = [];
    item.customizationGroups?.forEach((g) => {
      const opt = selectedOptions[g.id];
      if (opt) {
        choices.push({
          groupTitle: g.title,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        });
      }
    });

    if (onAddToCart) {
      onAddToCart(item, quantity, choices);
      setAddedToast(true);
      setTimeout(() => {
        setAddedToast(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="relative flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto">
          {/* Hero Image */}
          <div className="relative h-56 sm:h-72 w-full bg-zinc-100">
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 700px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

            {/* Badges Overlay */}
            <div className="absolute bottom-4 left-5 right-5 sm:left-6 sm:right-6 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black text-white ${
                      item.classification === "veg"
                        ? "bg-emerald-600"
                        : item.classification === "vegan"
                        ? "bg-teal-600"
                        : "bg-red-600"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {item.classification.toUpperCase()}
                  </span>

                  {item.badge && (
                    <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-zinc-950">
                      {item.badge}
                    </span>
                  )}
                </div>

                <h2 className="font-serif text-xl sm:text-3xl font-black text-white leading-tight">
                  {item.name}
                </h2>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xl sm:text-3xl font-black text-amber-300 block">
                  {formatINR(item.price)}
                </span>
                <span className="block text-[10px] text-zinc-300">
                  Incl. 5% GST
                </span>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-7 space-y-5">
            {/* Description */}
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 font-light">
              {item.description}
            </p>

            {/* Characteristic Badges Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {/* Serving Temp */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <Thermometer className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <span className="block text-[9px] font-bold text-zinc-400 uppercase">
                    Serving Temp
                  </span>
                  <span className="text-xs font-bold text-zinc-900">
                    {item.servingTemperature}
                  </span>
                </div>
              </div>

              {/* Spice Level */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <Flame className="h-4 w-4 text-orange-600 shrink-0" />
                <div>
                  <span className="block text-[9px] font-bold text-zinc-400 uppercase">
                    Spice Level
                  </span>
                  <span className="text-xs font-bold text-zinc-900">
                    {item.spiceLevel}
                  </span>
                </div>
              </div>

              {/* Flavour Note */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <span className="block text-[9px] font-bold text-zinc-400 uppercase">
                    Flavour
                  </span>
                  <span className="text-xs font-bold text-zinc-900 truncate block max-w-[140px]">
                    {item.flavour}
                  </span>
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h4 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase mb-2">
                Curated Ingredients
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {item.ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 border border-zinc-200"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            {/* Allergens warning */}
            {item.allergens.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Allergen Notice: </strong>
                  Contains {item.allergens.join(", ")}. Please inform our barista of severe sensitivities.
                </div>
              </div>
            )}

            {/* Customization Groups */}
            {item.customizationGroups && item.customizationGroups.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <h4 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Customize Preparation
                </h4>

                {item.customizationGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <label className="text-xs font-bold text-zinc-900 block">
                      {group.title}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.options.map((opt) => {
                        const isSelected =
                          selectedOptions[group.id]?.id === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOptionChange(group.id, opt)}
                            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                              isSelected
                                ? "border-zinc-950 bg-zinc-950 text-white shadow-xs"
                                : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                            }`}
                          >
                            <span className="font-semibold">{opt.name}</span>
                            <span
                              className={`text-[11px] font-bold ${
                                isSelected ? "text-amber-300" : "text-zinc-500"
                              }`}
                            >
                              {opt.priceDelta > 0
                                ? `+${formatINR(opt.priceDelta)}`
                                : "Free"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Quantity & Add to Cart */}
        <div className="border-t border-zinc-200 bg-zinc-50 p-4 sm:p-5 flex items-center justify-between gap-3">
          {/* Quantity Selector */}
          <div className="flex items-center rounded-xl border border-zinc-300 bg-white shadow-inner">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="p-2 sm:p-2.5 text-zinc-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-xs sm:text-sm font-black text-zinc-900">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="p-2 sm:p-2.5 text-zinc-600 hover:text-black transition"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Action button */}
          <button
            onClick={handleAdd}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-xs sm:text-sm font-black text-white shadow-md transition-all active:scale-95 ${
              addedToast
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-zinc-950 hover:bg-zinc-800"
            }`}
          >
            {addedToast ? (
              <>
                <Check className="h-4 w-4" />
                <span>Added to Order!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 text-amber-300" />
                <span>
                  {isTableMode ? "Add to Table Order" : "Select Item"} &bull;{" "}
                  {formatINR(totalPrice)}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
