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
  CheckCircle2,
  HeartHandshake,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const featuredItems = DEMO_MENU_ITEMS.filter((item) => item.isFeatured);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 selection:bg-amber-200">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-cafe-950 text-white">
          {/* Background image overlay */}
          <div className="absolute inset-0 z-0 opacity-30">
            <Image
              src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1920&q=80"
              alt="Brew & Bean Artisan Café Interior"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-cafe-950 via-cafe-950/80 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Specialty Coffee Roastery &bull; Indiranagar, Bengaluru</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.15]">
                Awaken Your Senses with Every Pour.
              </h1>

              <p className="text-base sm:text-lg text-zinc-300 leading-relaxed font-light">
                Welcome to <span className="font-semibold text-amber-300">{DEMO_SETTINGS.brandName}</span>.
                We craft small-batch Arabica pour-overs, cold-steeped nitro brews, and artisan sourdough
                eats in the heart of Indiranagar.
              </p>

              {/* Primary Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="flex items-center justify-center gap-2.5 rounded-full bg-amber-400 px-7 py-3.5 text-base font-bold text-cafe-950 shadow-xl hover:bg-amber-300 hover:shadow-amber-400/20 active:scale-95 transition"
                >
                  <QrCode className="h-5 w-5 text-cafe-950" />
                  <span>Scan Table QR to Order</span>
                </button>

                <Link
                  href="/menu"
                  className="flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-md hover:bg-white/20 transition"
                >
                  <span>Explore Digital Menu</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Live Info Pills */}
              <div className="pt-6 border-t border-zinc-800/80 flex flex-wrap items-center gap-6 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span>Open Daily 8:00 AM &ndash; 11:00 PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-400" />
                  <span>100ft Road, Indiranagar</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Category Exploration Section */}
        <section className="py-16 sm:py-20 border-b border-cafe-200/60 bg-cafe-50/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
                  Crafted with Passion
                </span>
                <h2 className="font-serif text-3xl font-bold text-cafe-950 mt-1">
                  Explore by Category
                </h2>
              </div>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-cafe-800 hover:text-cafe-950"
              >
                <span>Full Menu</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {DEMO_CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/menu?category=${cat.id}`}
                  className="group flex flex-col items-center text-center rounded-2xl border border-cafe-200 bg-white p-5 shadow-xs hover:border-cafe-500 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cafe-100 text-cafe-900 group-hover:bg-cafe-900 group-hover:text-amber-300 transition-colors mb-3">
                    <Coffee className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-sm font-bold text-cafe-950 group-hover:text-cafe-800">
                    {cat.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                    {cat.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Items Grid */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
                Signature Selections
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-cafe-950 mt-2">
                House Specialties &amp; Barista Picks
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Every cup is ground to order; every sandwich pressed on fresh artisan sourdough.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                className="inline-flex items-center gap-2 rounded-full bg-cafe-900 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-cafe-800 transition"
              >
                <span>Browse All 18+ Menu Items</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Experience & Quality Pillars */}
        <section className="py-16 bg-cafe-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-cafe-950">
                  <Coffee className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-amber-300">
                    Single-Origin Beans
                  </h3>
                  <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                    Sourced directly from Chikmagalur &amp; Coorg shade-grown estates, roasted weekly in small micro-lots.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-cafe-950">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-amber-300">
                    Scratch Sourdough Kitchen
                  </h3>
                  <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                    36-hour slow fermented sourdough, house basil pestos, and zero artificial preservatives.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-cafe-950">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-amber-300">
                    Instant Table QR Ordering
                  </h3>
                  <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                    Scan your table badge, customize your coffee, and our baristas will serve directly to your table.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Location & Hours Card */}
        <section className="py-16 sm:py-20 bg-cafe-100/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-cafe-200 bg-white shadow-xl grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 sm:p-12 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
                    Visit Our Roastery
                  </span>
                  <h2 className="font-serif text-3xl font-bold text-cafe-950 mt-1 mb-4">
                    Relax, Sip &amp; Dine with Us
                  </h2>
                  <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                    Nestled in the vibrant heart of Indiranagar, {DEMO_SETTINGS.brandName} offers
                    sunlit courtyard tables, high-speed Wi-Fi, power outlets at every booth, and a pet-friendly patio.
                  </p>

                  <div className="space-y-4 text-sm text-zinc-800">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Address</strong>
                        <span className="text-xs text-zinc-600">
                          {DEMO_SETTINGS.address}, {DEMO_SETTINGS.city} – {DEMO_SETTINGS.postalCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Operating Hours</strong>
                        <span className="text-xs text-zinc-600">
                          {DEMO_SETTINGS.openingHours}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center gap-4">
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-xl bg-cafe-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-cafe-800 transition"
                  >
                    <span>Get Directions &amp; Contact</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-cafe-300 bg-cafe-50 px-4 py-2.5 text-xs font-bold text-cafe-900 hover:bg-cafe-100 transition"
                  >
                    <QrCode className="h-3.5 w-3.5 text-amber-600" />
                    <span>Scan Table</span>
                  </button>
                </div>
              </div>

              {/* Photo */}
              <div className="relative min-h-[300px] lg:min-h-full bg-cafe-200">
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
