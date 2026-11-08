"use client";

import React from "react";
import Image from "next/image";
import { MenuItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Flame, Thermometer, Plus, Sparkles } from "lucide-react";

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onQuickAdd?: (item: MenuItem) => void;
  isTableMode?: boolean;
}

export default function MenuItemCard({
  item,
  onSelect,
  onQuickAdd,
  isTableMode = false,
}: MenuItemCardProps) {
  const isVeg = item.classification === "veg";
  const isVegan = item.classification === "vegan";

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cafe-200/90 bg-white shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99] hover:border-cafe-400"
    >
      {/* Media Aspect Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-cafe-100/60">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Top Floating Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {/* Veg / Vegan / Non-Veg Indicator */}
          <div className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 shadow-xs backdrop-blur-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isVeg
                  ? "bg-emerald-600 ring-2 ring-emerald-300"
                  : isVegan
                  ? "bg-teal-600 ring-2 ring-teal-300"
                  : "bg-red-600 ring-2 ring-red-300"
              }`}
            />
            <span className="text-[10px] font-black uppercase text-zinc-800 tracking-tight">
              {item.classification}
            </span>
          </div>

          {/* Special Chef/Bestseller Badge */}
          {item.badge && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-black uppercase text-cafe-950 shadow-xs backdrop-blur-xs">
              <Sparkles className="h-2.5 w-2.5" />
              <span>{item.badge}</span>
            </span>
          )}
        </div>

        {/* Bottom Floating Temperature & Spice chips */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white pointer-events-none">
          <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-xs">
            <Thermometer className="h-2.5 w-2.5 text-amber-300" />
            <span>{item.servingTemperature}</span>
          </span>

          {item.spiceLevel !== "None" && (
            <span className="flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur-xs">
              <Flame className="h-2.5 w-2.5" />
              <span>{item.spiceLevel}</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-3 sm:p-4 justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-serif text-sm sm:text-base font-bold text-cafe-950 group-hover:text-amber-800 transition-colors line-clamp-1 leading-snug">
              {item.name}
            </h3>
            <span className="text-sm sm:text-base font-black text-cafe-950 shrink-0">
              {formatINR(item.price)}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Flavour Note & Action Button */}
        <div className="pt-2 border-t border-cafe-100 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-zinc-400 line-clamp-1">
              <strong className="text-zinc-600 font-bold">Notes: </strong>
              {item.flavour}
            </span>
          </div>

          {isTableMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickAdd) onQuickAdd(item);
                else onSelect(item);
              }}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 rounded-xl bg-cafe-950 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-xs hover:bg-cafe-800 active:scale-95 transition shrink-0"
              aria-label={`Add ${item.name} to order`}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
