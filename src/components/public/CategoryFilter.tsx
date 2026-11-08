"use client";

import React from "react";
import { MenuCategory } from "@/lib/types";
import {
  Coffee,
  CupSoda,
  Utensils,
  Sparkles,
  Cake,
  GlassWater,
  LayoutGrid,
  Leaf,
  Flame,
} from "lucide-react";

interface CategoryFilterProps {
  categories: MenuCategory[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export default function CategoryFilter({
  categories,
  activeCategoryId,
  onSelectCategory,
}: CategoryFilterProps) {
  const getIcon = (id: string, iconName?: string) => {
    if (id === "artisan-coffee") return <Coffee className="h-4 w-4" />;
    if (id === "loose-leaf-tea") return <Leaf className="h-4 w-4" />;
    if (id === "gourmet-sandwiches") return <Utensils className="h-4 w-4" />;
    if (id === "small-bites") return <Flame className="h-4 w-4" />;
    if (id === "desserts") return <Cake className="h-4 w-4" />;
    if (id === "beverages") return <GlassWater className="h-4 w-4" />;

    switch (iconName) {
      case "Coffee":
        return <Coffee className="h-4 w-4" />;
      case "CupSoda":
        return <CupSoda className="h-4 w-4" />;
      case "Utensils":
        return <Utensils className="h-4 w-4" />;
      case "Sparkles":
        return <Sparkles className="h-4 w-4" />;
      case "Cake":
        return <Cake className="h-4 w-4" />;
      case "GlassWater":
        return <GlassWater className="h-4 w-4" />;
      default:
        return <Coffee className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
      <button
        onClick={() => onSelectCategory("all")}
        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all active:scale-95 ${
          activeCategoryId === "all"
            ? "bg-zinc-950 text-amber-300 shadow-sm"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span>All Categories</span>
      </button>

      {categories.map((cat) => {
        const isSelected = activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all active:scale-95 ${
              isSelected
                ? "bg-zinc-950 text-amber-300 shadow-sm"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {getIcon(cat.id, cat.iconName)}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
