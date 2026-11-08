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
} from "@/lib/demo-data";
import { MenuItem } from "@/lib/types";
import { Search, Sparkles, X } from "lucide-react";

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
        const matchesName = (item.name || "").toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        const matchesIngredient = (item.ingredients || []).some((ing) =>
          ing.toLowerCase().includes(q)
        );
        const matchesFlavour = (item.flavour || "").toLowerCase().includes(q);
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
        {/* Luxury Page Header */}
        <section className="border-b border-amber-900/10 bg-gradient-to-b from-white via-amber-50/20 to-white/60 py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-900 mb-3 border border-amber-400/30">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>Artisan Roastery &bull; Fresh Kitchen Daily</span>
                </div>
                <h1 className="font-serif text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
                  Digital Menu &amp; Ingredients
                </h1>
                <p className="mt-2 text-xs sm:text-base text-zinc-600 max-w-2xl font-light leading-relaxed">
                  Explore our single-origin coffees, whole botanical infusions, 36-hour scratch sourdough sandwiches, and signature pastries with transparent allergen disclosures.
                </p>
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Kitchen &bull; Handcrafted to Order</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Filter Controls Bar */}
        <section className="sticky top-18 sm:top-20 z-30 border-b border-amber-900/10 bg-[#FAF7F2]/95 backdrop-blur-xl py-3.5 shadow-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-3">
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
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-9 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-800 focus:outline-none shadow-xs transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dietary Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: "all", label: "All Diets", dot: null },
                  { id: "veg", label: "Pure Veg", dot: "bg-emerald-500" },
                  { id: "vegan", label: "Vegan", dot: "bg-teal-500" },
                  { id: "non-veg", label: "Non-Veg", dot: "bg-red-500" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setSelectedVegFilter(pill.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shrink-0 ${
                      selectedVegFilter === pill.id
                        ? "bg-zinc-950 text-white shadow-xs"
                        : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    {pill.dot && <span className={`h-2 w-2 rounded-full ${pill.dot}`} />}
                    <span>{pill.label}</span>
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

        {/* Menu Items Grid & Result Counter */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 px-1">
            <span>
              Showing <strong className="text-zinc-900">{filteredItems.length}</strong> items
            </span>
            {(activeCategory !== "all" || selectedVegFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setSelectedVegFilter("all");
                  setSearchQuery("");
                }}
                className="text-amber-800 hover:text-amber-950 font-bold underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-12 text-center my-8 shadow-xs">
              <Search className="h-10 w-10 text-zinc-400 mb-3" />
              <h3 className="font-serif text-lg font-bold text-zinc-950">
                No menu items match your criteria
              </h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm leading-relaxed">
                Try searching for something else like &ldquo;Flat White&rdquo;, &ldquo;Sourdough&rdquo;, or reset your filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  setSelectedVegFilter("all");
                }}
                className="mt-4 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
