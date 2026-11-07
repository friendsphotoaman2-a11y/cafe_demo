import React from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { Coffee, Heart, Award, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { DEMO_SETTINGS } from "@/lib/demo-data";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900">
      <Navbar />

      <main className="flex-1">
        {/* Hero Banner */}
        <section className="relative overflow-hidden bg-cafe-950 text-white py-20 sm:py-28">
          <div className="absolute inset-0 z-0 opacity-25">
            <Image
              src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1920&q=80"
              alt="Coffee beans roaster"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-cafe-950 via-cafe-950/70 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Our Roots &amp; Craft Philosophy</span>
            </span>

            <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-white">
              Rooted in Bean Sourcing. Dedicated to the Perfect Cup.
            </h1>

            <p className="mt-4 text-base sm:text-lg text-zinc-300 leading-relaxed font-light">
              At {DEMO_SETTINGS.brandName}, coffee is neither an afterthought nor a rush. It is a slow,
              reverent art that unites heritage Indian estates with contemporary extraction techniques.
            </p>
          </div>
        </section>

        {/* The Roasting Story */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
                  Where Coffee Originates
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-cafe-950">
                  High-Altitude Chikmagalur &amp; Coorg Shade-Grown Arabica
                </h2>
                <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
                  Every batch of beans roasted at {DEMO_SETTINGS.brandName} is sourced from regenerative,
                  shade-grown family estates nestled at 3,800 to 4,500 feet elevation in the Western Ghats of Karnataka.
                </p>
                <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
                  Intercropped beneath canopy trees among wild cardamom, black pepper vines, and orange blossoms,
                  our cherries mature slowly. This extended ripening period imparts deep natural sweetness, velvety body,
                  and bright fruit nuances to each bean.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-cafe-200">
                  <div className="rounded-xl bg-white p-4 border border-cafe-200 shadow-xs">
                    <span className="font-serif text-2xl font-bold text-cafe-900 block">
                      100%
                    </span>
                    <span className="text-xs text-zinc-600">
                      Single-Origin Estate Arabica
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-4 border border-cafe-200 shadow-xs">
                    <span className="font-serif text-2xl font-bold text-cafe-900 block">
                      36-Hr
                    </span>
                    <span className="text-xs text-zinc-600">
                      Natural Sourdough Fermentation
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative h-96 lg:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-cafe-200">
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
        <section className="py-16 bg-cafe-100/50 border-y border-cafe-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative h-96 lg:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-cafe-200">
                <Image
                  src="https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=1000&q=80"
                  alt="Artisan Sourdough and Fresh Ingredients"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="order-1 lg:order-2 space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-cafe-600">
                  From Scratch Kitchen
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-cafe-950">
                  Honest Ingredients. No Pre-made Bases.
                </h2>
                <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
                  We believe food in a coffee shop should match the care of the coffee. Our bread is wild-yeast sourdough baked daily with natural starters. Our pestos are made in small mortars with sweet basil and pine nuts.
                </p>
                <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
                  Whether you order our Wild Truffle Mushroom Panini or our Blueberry Basque Cheesecake, everything is prepped by human hands in our Indiranagar kitchen.
                </p>

                <div className="pt-2">
                  <Link
                    href="/menu"
                    className="inline-flex items-center gap-2 rounded-full bg-cafe-900 px-6 py-3 text-sm font-bold text-white hover:bg-cafe-800 transition"
                  >
                    <span>Browse Our Kitchen Menu</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ethical Values */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-serif text-3xl font-bold text-cafe-950 mb-12">
              Our Core Commitments
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-cafe-950 mb-2">
                  Direct Farmer Premiums
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  We pay 40% above fair-trade floor prices directly to our coffee farm partners in Karnataka, fostering long-term soil sustainability.
                </p>
              </div>

              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <Heart className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-cafe-950 mb-2">
                  Eco-Conscious Packaging
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  100% compostable sugarcane takeaway containers, plant-based cups, and zero single-use plastic straws or lids.
                </p>
              </div>

              <div className="rounded-2xl border border-cafe-200 bg-white p-6 shadow-xs">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-cafe-950 mb-2">
                  Transparent Ingredients
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Every allergen, ingredient, and calorie profile is openly documented on our digital table ordering screens.
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

