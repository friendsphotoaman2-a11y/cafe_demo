"use client";

import React from "react";
import { MenuCategory } from "@/lib/types";
import { Coffee, CupSoda, Utensils, Sparkles, Cake, GlassWater, LayoutGrid } from "lucide-react";

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
  const getIcon = (iconName: string) => {
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
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => onSelectCategory("all")}
        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition ${
          activeCategoryId === "all"
            ? "bg-cafe-900 text-white shadow-md"
            : "bg-white text-zinc-700 border border-cafe-200/80 hover:bg-cafe-100/70"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span>All Items</span>
      </button>

      {categories.map((cat) => {
        const isSelected = activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              isSelected
                ? "bg-cafe-900 text-white shadow-md"
                : "bg-white text-zinc-700 border border-cafe-200/80 hover:bg-cafe-100/70"
            }`}
          >
            {getIcon(cat.iconName)}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}

