"use client";

import React from "react";
import Image from "next/image";
import { MenuItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Flame, Thermometer, Plus } from "lucide-react";

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
  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cafe-200/80 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* Image Container */}
      <div className="relative h-48 w-full overflow-hidden bg-cafe-100">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          {/* Veg / Non-Veg Indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold backdrop-blur-md shadow-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                item.classification === "veg"
                  ? "bg-emerald-600 ring-2 ring-emerald-300"
                  : item.classification === "vegan"
                  ? "bg-teal-600 ring-2 ring-teal-300"
                  : "bg-red-600 ring-2 ring-red-300"
              }`}
            />
            <span className="capitalize text-zinc-800 text-[11px]">
              {item.classification}
            </span>
          </div>

          {/* Special Badge if any */}
          {item.badge && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              {item.badge}
            </span>
          )}
        </div>

        {/* Temperature & Spice tags at bottom of image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
          <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-sm text-[11px]">
            <Thermometer className="h-3 w-3 text-amber-300" />
            {item.servingTemperature}
          </span>

          {item.spiceLevel !== "None" && (
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-sm text-[11px] text-amber-300">
              <Flame className="h-3 w-3" />
              {item.spiceLevel} Spice
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-serif text-lg font-bold text-cafe-950 group-hover:text-cafe-700 transition-colors line-clamp-1">
            {item.name}
          </h3>
          <span className="text-base font-extrabold text-cafe-900 shrink-0">
            {formatINR(item.price)}
          </span>
        </div>

        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed mb-3">
          {item.description}
        </p>

        {/* Flavour note */}
        <div className="mb-4 rounded-lg bg-cafe-50 px-2.5 py-1.5 text-[11px] text-cafe-800 border border-cafe-200/50">
          <span className="font-semibold text-cafe-950">Profile: </span>
          {item.flavour}
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-cafe-100">
          <span className="text-xs font-semibold text-cafe-600 hover:text-cafe-900">
            View Details &rarr;
          </span>

          {isTableMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickAdd) onQuickAdd(item);
                else onSelect(item);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-cafe-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cafe-800 active:scale-95 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

