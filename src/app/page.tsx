"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import QrScannerModal from "@/components/public/QrScannerModal";
import MenuItemCard from "@/components/public/MenuItemCard";
import ItemDetailModal from "@/components/public/ItemDetailModal";
import {
  DEMO_SETTINGS,
  DEMO_CATEGORIES,
  DEMO_MENU_ITEMS,
} from "@/lib/demo-data";
import { MenuItem } from "@/lib/types";
import {
  QrCode,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  Coffee,
  HeartHandshake,
  ChevronRight,
  Leaf,
  UtensilsCrossed,
  CakeSlice,
  GlassWater,
  Star,
  Flame,
  Zap,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "artisan-coffee": Coffee,
  "loose-leaf-tea": Leaf,
  "gourmet-sandwiches": UtensilsCrossed,
  "small-bites": Flame,
  "desserts": CakeSlice,
  "beverages": GlassWater,
  "cold-beverages": GlassWater,
};

export default function HomePage() {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "coffee" | "food">("all");

  const featuredItems = DEMO_MENU_ITEMS.filter((item) => {
    if (!item.isFeatured) return false;
    if (activeFilter === "coffee") return item.categoryId === "artisan-coffee";
    if (activeFilter === "food") return item.categoryId !== "artisan-coffee";
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 selection:bg-amber-200">
      <Navbar />

      <main className="flex-1">
        {/* Luxury Hero Section with Visual Showcase */}
        <section className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-amber-950 text-white">
          {/* Ambient Lighting & Glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/15 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/10 blur-[130px] pointer-events-none rounded-full" />

          {/* Background Texture Overlay */}
          <div className="absolute inset-0 z-0 opacity-15">
            <Image
              src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1920&q=80"
              alt="Brew & Bean Artisan Café Interior"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-950/70" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              
              {/* Left Column: Story, Title, Actions, Badges (7 cols) */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-7">
                {/* Roastery Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Specialty Coffee Roasters &bull; Indiranagar, Bengaluru</span>
                </div>

                {/* Hero Title */}
                <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
                  Awaken Your Senses With{" "}
                  <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                    Every Pour.
                  </span>
                </h1>

                {/* Subtitle / Tagline */}
                <p className="text-sm sm:text-lg text-zinc-300 leading-relaxed font-light max-w-xl">
                  Small-batch Chikmagalur Arabica roasted weekly, 36-hour slow-fermented wild sourdough, and sunlit courtyard seating. Handcrafted to order at your table.
                </p>

                {/* Primary Actions */}
                <div className="pt-1 flex flex-col sm:flex-row gap-3.5 sm:gap-4">
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="group flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 bg-[length:200%_auto] hover:bg-right px-7 py-4 text-sm sm:text-base font-black text-zinc-950 shadow-xl hover:shadow-amber-500/25 active:scale-95 transition-all duration-300"
                  >
                    <QrCode className="h-5 w-5 text-zinc-950 transition-transform group-hover:rotate-12" />
                    <span>Scan Table QR to Order</span>
                    <ArrowRight className="h-4 w-4 opacity-75 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <Link
                    href="/menu"
                    className="flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-white/10 hover:bg-white/15 px-7 py-4 text-sm sm:text-base font-bold text-white backdrop-blur-md transition-all active:scale-95 shadow-xs"
                  >
                    <Coffee className="h-4 w-4 text-amber-400" />
                    <span>Explore Digital Menu</span>
                  </Link>
                </div>

                {/* Quality & Trust Ribbon */}
                <div className="pt-6 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-300">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold">4.9 ★ Rating</strong>
                      <span className="text-[11px] text-zinc-400">1,200+ Reviews</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold">100% Arabica</strong>
                      <span className="text-[11px] text-zinc-400">Chikmagalur Estates</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold">8 AM &ndash; 11 PM</strong>
                      <span className="text-[11px] text-zinc-400">Open 7 Days</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold">Table QR</strong>
                      <span className="text-[11px] text-zinc-400">Zero Wait Time</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual Photo Showcase with Floating Glass Cards (5 cols) */}
              <div className="lg:col-span-5 relative">
                {/* Glow Backdrop */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-amber-500/20 to-amber-700/20 rounded-3xl blur-2xl pointer-events-none" />

                {/* Primary Photo Showcase Container */}
                <div className="relative rounded-3xl overflow-hidden border border-amber-400/25 bg-zinc-900 shadow-2xl">
                  {/* Photo with zoom effect */}
                  <div className="relative aspect-[4/5] sm:aspect-[4/4] lg:aspect-[4/5] w-full overflow-hidden">
                    <Image
                      src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=85"
                      alt="Artisan Barista Pouring Specialty Coffee"
                      fill
                      priority
                      className="object-cover object-center transition-transform duration-700 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/20" />
                  </div>

                  {/* Top-Left Floating Badge for Live Table Dining */}
                  <div className="absolute top-4 left-4 rounded-2xl bg-zinc-950/85 border border-white/20 px-3 py-2 backdrop-blur-xl shadow-xl flex items-center gap-2 z-10">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-white tracking-wide">Table QR Active</span>
                  </div>

                  {/* Top-Right Floating Rating Glass Card */}
                  <div className="absolute top-4 right-4 rounded-2xl bg-zinc-950/85 border border-white/20 p-2.5 sm:p-3 backdrop-blur-xl shadow-xl flex items-center gap-2.5 z-10">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-black">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-zinc-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs sm:text-sm text-white">4.9 / 5.0</span>
                        <span className="text-[10px] text-amber-400 font-bold">Verified</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-zinc-300">1,200+ Reviews</span>
                    </div>
                  </div>

                  {/* Bottom Floating Signature Item Card */}
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-zinc-950/90 border border-white/20 p-3 sm:p-3.5 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shrink-0">
                        <Coffee className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-serif text-xs sm:text-sm font-bold text-white truncate">
                          Indiranagar Flat White
                        </h4>
                        <p className="text-[10px] sm:text-[11px] text-amber-200 truncate">
                          Chikmagalur Arabica &bull; Silky Micro-foam
                        </p>
                      </div>
                    </div>
                    <span className="font-serif font-black text-amber-300 text-sm sm:text-base shrink-0">
                      ₹240
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Category Exploration Section */}
        <section className="py-14 sm:py-20 border-b border-amber-900/10 bg-white/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Curated Craft Selections
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl font-black text-zinc-950 mt-1">
                  Explore by Category
                </h2>
              </div>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-800 hover:text-amber-950"
              >
                <span>View Full Menu</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* 6 Category Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {DEMO_CATEGORIES.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.id] || Coffee;
                const itemCount = DEMO_MENU_ITEMS.filter((i) => i.categoryId === cat.id).length;
                return (
                  <Link
                    key={cat.id}
                    href={`/menu?category=${cat.id}`}
                    className="group relative flex flex-col items-center text-center rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs hover:border-amber-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-900 group-hover:bg-zinc-950 group-hover:text-amber-400 transition-colors mb-3 shadow-xs">
                      <IconComponent className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <h3 className="font-serif text-xs sm:text-sm font-bold text-zinc-950 group-hover:text-amber-900 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-zinc-100 group-hover:bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-zinc-600 group-hover:text-amber-900 transition-colors">
                      {itemCount} Items
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Featured Items Grid */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Chef &amp; Barista Picks
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl font-black text-zinc-950 mt-1">
                  Signature Roastery Specialties
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-zinc-600 max-w-xl font-light">
                  Ground to order, crafted with single-origin beans and served piping fresh.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-full border border-zinc-200">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === "all"
                      ? "bg-zinc-950 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  All Picks ({DEMO_MENU_ITEMS.filter((i) => i.isFeatured).length})
                </button>
                <button
                  onClick={() => setActiveFilter("coffee")}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === "coffee"
                      ? "bg-zinc-950 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Coffee Only
                </button>
                <button
                  onClick={() => setActiveFilter("food")}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === "food"
                      ? "bg-zinc-950 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Kitchen Eats
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onSelect={(i) => setSelectedItem(i)}
                />
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-4 text-xs sm:text-sm font-black text-white shadow-md hover:bg-zinc-800 transition active:scale-95"
              >
                <span>Explore Complete Menu &amp; Ingredients</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Experience & Quality Bento Pillars */}
        <section className="py-16 sm:py-20 bg-gradient-to-b from-zinc-950 to-zinc-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                The Brew &amp; Bean Standard
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-black text-white mt-1">
                Why Our Coffee Tastes Different
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-amber-400/40 transition">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-md">
                  <Coffee className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-amber-200">
                  Single-Origin Shade Arabica
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-light">
                  Direct from 4,000ft Chikmagalur estates where cherries mature beneath native canopy shade, yielding rich chocolate undertones.
                </p>
              </div>

              <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-amber-400/40 transition">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-md">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-amber-200">
                  36-Hour Sourdough Kitchen
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-light">
                  Slow wild-ferment sourdough breads, scratch basil pesto, and fresh seasonal fillings without artificial preservatives.
                </p>
              </div>

              <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-amber-400/40 transition">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-md">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-amber-200">
                  Seamless Table Ordering
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-light">
                  Scan the badge at your table to customize milk, sweetness, and accompaniments. Baristas deliver directly to your seat.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Location, Hours & Ambiance Showcase */}
        <section className="py-16 sm:py-20 bg-amber-50/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 sm:p-12 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-300 mb-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Open Daily &bull; 8:00 AM &ndash; 11:00 PM</span>
                  </div>

                  <h2 className="font-serif text-3xl sm:text-4xl font-black text-zinc-950 mb-3">
                    Relax, Sip &amp; Dine with Us
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-6 font-light">
                    Nestled in Indiranagar, {DEMO_SETTINGS.brandName} offers sunlit courtyard tables, high-speed 5G Wi-Fi with power outlets at every booth, and a pet-friendly patio.
                  </p>

                  <div className="space-y-4 text-xs sm:text-sm text-zinc-800">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Address</strong>
                        <span className="text-xs text-zinc-600">
                          {DEMO_SETTINGS.address}, {DEMO_SETTINGS.city} &ndash; {DEMO_SETTINGS.postalCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Service Hours</strong>
                        <span className="text-xs text-zinc-600">
                          Breakfast &amp; Pour-overs from 8:00 AM. Kitchen closes at 10:30 PM.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center gap-3">
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition"
                  >
                    <span>Directions &amp; Contact</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-900 hover:bg-zinc-100 transition"
                  >
                    <QrCode className="h-3.5 w-3.5 text-amber-600" />
                    <span>Scan Table QR</span>
                  </button>
                </div>
              </div>

              {/* Photo Showcase */}
              <div className="relative min-h-[320px] lg:min-h-full bg-zinc-100">
                <Image
                  src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80"
                  alt="Brew & Bean Cozy Seating"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Modals */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

      <ItemDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
