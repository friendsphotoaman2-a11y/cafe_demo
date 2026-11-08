import React from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import {
  Heart,
  Award,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { DEMO_SETTINGS } from "@/lib/demo-data";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900">
      <Navbar />

      <main className="flex-1">
        {/* Luxury Hero Banner */}
        <section className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-amber-950 text-white py-20 sm:py-32">
          <div className="absolute inset-0 z-0 opacity-25">
            <Image
              src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1920&q=80"
              alt="Coffee beans roaster"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Our Roots &amp; Roasting Philosophy</span>
            </span>

            <h1 className="font-serif text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.15]">
              Rooted in Bean Sourcing. Dedicated to the Perfect Cup.
            </h1>

            <p className="mt-4 text-sm sm:text-lg text-zinc-300 leading-relaxed font-light max-w-2xl mx-auto">
              At {DEMO_SETTINGS.brandName}, coffee is neither an afterthought nor a rush. It is a slow,
              reverent art uniting heritage Western Ghats estates with contemporary extraction techniques.
            </p>
          </div>
        </section>

        {/* The Roasting Story */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Origin &amp; Terroir
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-black text-zinc-950 leading-tight">
                  High-Altitude Chikmagalur &amp; Coorg Shade-Grown Arabica
                </h2>
                <p className="text-xs sm:text-base text-zinc-700 leading-relaxed font-light">
                  Every batch of beans roasted at {DEMO_SETTINGS.brandName} is sourced from regenerative,
                  shade-grown family estates nestled at 3,800 to 4,500 feet elevation in the Western Ghats of Karnataka.
                </p>
                <p className="text-xs sm:text-base text-zinc-700 leading-relaxed font-light">
                  Intercropped beneath native jungle canopy among wild cardamom and black pepper vines,
                  our cherries mature slowly. This extended ripening period imparts deep natural sweetness, velvety chocolate body,
                  and bright citrus nuances.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200">
                  <div className="rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs">
                    <span className="font-serif text-3xl font-black text-amber-900 block">
                      100%
                    </span>
                    <span className="text-xs font-bold text-zinc-700">
                      Single-Origin Estate Arabica
                    </span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Direct trade with certified estates</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 border border-zinc-200 shadow-xs">
                    <span className="font-serif text-3xl font-black text-amber-900 block">
                      36-Hr
                    </span>
                    <span className="text-xs font-bold text-zinc-700">
                      Wild Sourdough Ferment
                    </span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Slow cold-proofed bread daily</p>
                  </div>
                </div>
              </div>

              <div className="relative h-80 sm:h-96 lg:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-zinc-200">
                <Image
                  src="https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1000&q=80"
                  alt="Barista brewing pour over coffee"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Scratch Kitchen Story */}
        <section className="py-16 sm:py-24 bg-white/70 border-y border-amber-900/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative h-80 sm:h-96 lg:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-zinc-200">
                <Image
                  src="https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=1000&q=80"
                  alt="Artisan Sourdough and Fresh Ingredients"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="order-1 lg:order-2 space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Scratch Kitchen Philosophy
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-black text-zinc-950 leading-tight">
                  Honest Ingredients. No Pre-Made Bases.
                </h2>
                <p className="text-xs sm:text-base text-zinc-700 leading-relaxed font-light">
                  We believe food in a specialty roastery should match the integrity of our coffee. Our bread is wild-yeast sourdough baked daily with natural starters. Our pestos are pounded in small batches with sweet basil and pine nuts.
                </p>
                <p className="text-xs sm:text-base text-zinc-700 leading-relaxed font-light">
                  From our Wild Truffle Mushroom Panini to our Basque Cheesecake with fresh berry compote, every order is prepared fresh by hand in our Indiranagar kitchen.
                </p>

                <div className="pt-2">
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3.5 text-xs font-bold text-white hover:bg-zinc-800 shadow-md transition active:scale-95"
                  >
                    <span>Browse Our Kitchen Menu</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values Bento Grid */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Guiding Principles
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-black text-zinc-950 mt-1">
                Our Core Commitments
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-xs space-y-3 hover:border-amber-400 transition">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                  <Award className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-bold text-zinc-950">
                  Direct Farmer Premiums
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-light">
                  We pay 40% above fair-trade floor prices directly to our estate partners in Chikmagalur, fostering sustainable soil stewardship and community prosperity.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-xs space-y-3 hover:border-amber-400 transition">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-bold text-zinc-950">
                  Eco-Conscious Packaging
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-light">
                  100% compostable sugarcane takeaway boxes, plant-based cups, and zero single-use plastic straws or lids across all customer packaging.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-xs space-y-3 hover:border-amber-400 transition">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-bold text-zinc-950">
                  Full Ingredient Transparency
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-light">
                  Every allergen, ingredient, and spice parameter is openly documented on our table QR ordering screens so you always dine with peace of mind.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
