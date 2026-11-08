import React from "react";
import Link from "next/link";
import { Coffee, MapPin, Clock, Phone, Mail, Sparkles, Heart } from "lucide-react";
import { DEMO_SETTINGS } from "@/lib/demo-data";

export default function Footer() {
  return (
    <footer className="border-t border-amber-950/20 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 font-black shadow-md">
                <Coffee className="h-6 w-6" />
              </div>
              <div>
                <span className="font-serif text-2xl font-black tracking-tight text-white block">
                  {DEMO_SETTINGS.brandName}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                  Specialty Roastery &bull; Bangalore
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-400">
              {DEMO_SETTINGS.tagline}. Single-origin Western Ghats Arabica, slow-fermented sourdough, and sunlit courtyard dining in Indiranagar.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
              <Sparkles className="h-3 w-3" />
              <span>Small-Batch Micro Roaster</span>
            </div>
          </div>

          {/* Quick Nav */}
          <div>
            <h4 className="font-serif text-sm sm:text-base font-bold text-white uppercase tracking-wider mb-4 text-amber-200">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-400">
              <li>
                <Link href="/" className="hover:text-amber-300 transition-colors">
                  Home Experience
                </Link>
              </li>
              <li>
                <Link href="/menu" className="hover:text-amber-300 transition-colors">
                  Digital Menu &amp; Ingredients
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-amber-300 transition-colors">
                  Customer Profile &amp; 5-Stamp Card
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-amber-300 transition-colors">
                  Roasting &amp; Sourdough Craft
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-amber-300 transition-colors">
                  Hours &amp; Location Directions
                </Link>
              </li>
            </ul>
          </div>

          {/* Hours & Ambiance */}
          <div>
            <h4 className="font-serif text-sm sm:text-base font-bold text-white uppercase tracking-wider mb-4 text-amber-200">
              Hours &amp; Space
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-zinc-400">
              <li className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="block text-zinc-200">{DEMO_SETTINGS.openingHours}</strong>
                  <span className="text-[11px] text-zinc-500">Kitchen last call at 10:30 PM</span>
                </div>
              </li>
              <li className="text-xs text-zinc-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                🌿 Pet-friendly courtyard &bull; 5G Guest Wi-Fi with power stations &bull; Mezzanine co-working tables.
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="font-serif text-sm sm:text-base font-bold text-white uppercase tracking-wider mb-4 text-amber-200">
              Visit Roastery
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-zinc-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <span>
                  {DEMO_SETTINGS.address}, {DEMO_SETTINGS.city} &ndash; {DEMO_SETTINGS.postalCode}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-amber-400 shrink-0" />
                <a href={`tel:${DEMO_SETTINGS.phone}`} className="hover:text-white transition">
                  {DEMO_SETTINGS.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                <a href={`mailto:${DEMO_SETTINGS.email}`} className="hover:text-white transition">
                  {DEMO_SETTINGS.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-zinc-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>
            &copy; {new Date().getFullYear()} {DEMO_SETTINGS.brandName}. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/controlroom" className="hover:text-zinc-300 transition">
              Staff Control Room
            </Link>
            <span className="h-3 w-px bg-zinc-800" />
            <span className="flex items-center gap-1 text-zinc-400">
              Brewed with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> in Bengaluru
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
