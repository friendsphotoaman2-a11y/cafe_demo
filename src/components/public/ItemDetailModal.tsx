"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  MenuItem,
  CustomizationGroup,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Sticky Close Button */}
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
          <div className="relative h-64 sm:h-72 w-full bg-cafe-100">
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 700px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Badges Overlay */}
            <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                      item.classification === "veg"
                        ? "bg-emerald-600"
                        : item.classification === "vegan"
                        ? "bg-teal-600"
                        : "bg-red-600"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-white" />
                    {item.classification.toUpperCase()}
                  </span>

                  {item.badge && (
                    <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  {item.name}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                  {formatINR(item.price)}
                </span>
                <span className="block text-[11px] text-zinc-300">
                  Incl. applicable taxes
                </span>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Description */}
            <p className="text-sm sm:text-base leading-relaxed text-zinc-700">
              {item.description}
            </p>

            {/* Characteristic Badges Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Serving Temp */}
              <div className="flex items-center gap-2.5 rounded-xl border border-cafe-200/70 bg-cafe-50/70 p-3">
                <Thermometer className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="block text-[10px] font-semibold text-zinc-500 uppercase">
                    Serving Temp
                  </span>
                  <span className="text-xs font-bold text-cafe-950">
                    {item.servingTemperature}
                  </span>
                </div>
              </div>

              {/* Spice Level */}
              <div className="flex items-center gap-2.5 rounded-xl border border-cafe-200/70 bg-cafe-50/70 p-3">
                <Flame className="h-5 w-5 text-orange-600 shrink-0" />
                <div>
                  <span className="block text-[10px] font-semibold text-zinc-500 uppercase">
                    Spice Level
                  </span>
                  <span className="text-xs font-bold text-cafe-950">
                    {item.spiceLevel}
                  </span>
                </div>
              </div>

              {/* Flavour Note */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 rounded-xl border border-cafe-200/70 bg-cafe-50/70 p-3">
                <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <span className="block text-[10px] font-semibold text-zinc-500 uppercase">
                    Flavour
                  </span>
                  <span className="text-xs font-bold text-cafe-950 truncate block max-w-[130px]">
                    {item.flavour}
                  </span>
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase mb-2">
                Curated Ingredients
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 border border-zinc-200/60"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            {/* Allergens warning */}
            {item.allergens.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Allergen Notice: </span>
                  Contains {item.allergens.join(", ")}. Please inform our team of severe sensitivities.
                </div>
              </div>
            )}

            {/* Customization Groups */}
            {item.customizationGroups && item.customizationGroups.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  Customize Your Item
                </h4>

                {item.customizationGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 block">
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
                                ? "border-cafe-800 bg-cafe-900 text-white shadow-sm"
                                : "border-zinc-200 bg-white text-zinc-800 hover:border-cafe-400"
                            }`}
                          >
                            <span className="font-medium">{opt.name}</span>
                            <span
                              className={`text-[11px] font-semibold ${
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
        <div className="border-t border-zinc-200 bg-zinc-50/90 p-4 sm:p-5 flex items-center justify-between gap-4">
          {/* Quantity Selector */}
          <div className="flex items-center rounded-xl border border-zinc-300 bg-white shadow-inner">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="p-2.5 text-zinc-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-zinc-900">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="p-2.5 text-zinc-600 hover:text-black transition"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Action button */}
          <button
            onClick={handleAdd}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-bold text-white shadow-md transition-all active:scale-95 ${
              addedToast
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-cafe-900 hover:bg-cafe-800"
            }`}
          >
            {addedToast ? (
              <>
                <Check className="h-4 w-4" />
                <span>Added to Table Order!</span>
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

