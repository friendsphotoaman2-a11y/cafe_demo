"use client";

import React, { useState, useMemo } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import CategoryFilter from "@/components/public/CategoryFilter";
import MenuItemCard from "@/components/public/MenuItemCard";
import ItemDetailModal from "@/components/public/ItemDetailModal";
import {
  DEMO_CATEGORIES,
  DEMO_MENU_ITEMS,
  DEMO_SETTINGS,
} from "@/lib/demo-data";
import { MenuItem, VegClassification } from "@/lib/types";
import { Search, SlidersHorizontal, Sparkles, AlertCircle } from "lucide-react";

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVegFilter, setSelectedVegFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const filteredItems = useMemo(() => {
    return DEMO_MENU_ITEMS.filter((item) => {
      // Category match
      if (activeCategory !== "all" && item.categoryId !== activeCategory) {
        return false;
      }
      // Veg/Dietary match
      if (selectedVegFilter !== "all") {
        if (selectedVegFilter === "veg" && item.classification !== "veg") return false;
        if (selectedVegFilter === "vegan" && item.classification !== "vegan") return false;
        if (selectedVegFilter === "non-veg" && item.classification !== "non-veg") return false;
      }
      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesIngredient = item.ingredients.some((ing) =>
          ing.toLowerCase().includes(q)
        );
        const matchesFlavour = item.flavour.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesIngredient && !matchesFlavour) {
          return false;
        }
      }
      return true;
    });
  }, [activeCategory, selectedVegFilter, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900">
      <Navbar />

      <main className="flex-1 pb-20">
        {/* Page Header */}
        <section className="border-b border-cafe-200/70 bg-white/70 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 mb-2 border border-amber-300/40">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Artisan Roastery &amp; Fresh Kitchen</span>
                </div>
                <h1 className="font-serif text-3xl sm:text-5xl font-bold text-cafe-950">
                  Digital Menu &amp; Ingredients
                </h1>
                <p className="mt-2 text-sm sm:text-base text-zinc-600 max-w-2xl">
                  Explore our single-origin coffees, whole botanical teas, scratch sourdough sandwiches, and artisanal pastries with full allergen and flavour transparency.
                </p>
              </div>

              {/* Demo Fixture Pill */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-500">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Fictional Demo Menu &bull; INR Pricing</span>
              </div>
            </div>
          </div>
        </section>

        {/* Filter Controls Bar */}
        <section className="sticky top-20 z-30 border-b border-cafe-200 bg-[#FAF7F2]/95 backdrop-blur-md py-4 shadow-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
            {/* Search Input and Dietary Chips */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, ingredient, or flavour..."
                  className="w-full rounded-xl border border-cafe-200 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600 shadow-xs"
                />
              </div>

              {/* Dietary Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filter:
                </span>
                {[
                  { id: "all", label: "All Diets" },
                  { id: "veg", label: "Pure Veg" },
                  { id: "vegan", label: "Vegan" },
                  { id: "non-veg", label: "Non-Veg" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setSelectedVegFilter(pill.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selectedVegFilter === pill.id
                        ? "bg-cafe-900 text-white"
                        : "bg-white text-zinc-700 border border-cafe-200 hover:bg-cafe-100"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category horizontal scrolling bar */}
            <CategoryFilter
              categories={DEMO_CATEGORIES}
              activeCategoryId={activeCategory}
              onSelectCategory={(id) => setActiveCategory(id)}
            />
          </div>
        </section>

        {/* Menu Items Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-cafe-300 bg-white/50 p-12 text-center my-8">
              <Search className="h-10 w-10 text-zinc-400 mb-3" />
              <h3 className="font-serif text-lg font-bold text-cafe-950">
                No items match your search
              </h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Try searching for something else like &ldquo;Flat White&rdquo;, &ldquo;Sourdough&rdquo;, or reset your filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  setSelectedVegFilter("all");
                }}
                className="mt-4 rounded-xl bg-cafe-900 px-4 py-2 text-xs font-semibold text-white hover:bg-cafe-800"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onSelect={(i) => setSelectedItem(i)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      <ItemDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

