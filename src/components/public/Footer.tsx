import React from "react";
import Link from "next/link";
import { Coffee, MapPin, Clock, Phone, Mail } from "lucide-react";
import { DEMO_SETTINGS } from "@/lib/demo-data";

export default function Footer() {
  return (
    <footer className="border-t border-cafe-200 bg-cafe-950 text-cafe-100">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 font-bold">
                <Coffee className="h-5 w-5" />
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-white">
                {DEMO_SETTINGS.brandName}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              {DEMO_SETTINGS.tagline}. Single-origin South Indian coffee beans, slow-steeped cold brews, and fresh artisanal sourdough kitchen in Indiranagar.
            </p>
            <div className="inline-block rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              Fictional Demo Café &bull; Phase 1 Prototype
            </div>
          </div>

          {/* Quick Nav */}
          <div>
            <h4 className="font-serif text-base font-semibold text-white mb-4">
              Explore Café
            </h4>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              <li>
                <Link href="/" className="hover:text-amber-300 transition">
                  Home Experience
                </Link>
              </li>
              <li>
                <Link href="/menu" className="hover:text-amber-300 transition">
                  Digital Menu &amp; Ingredients
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-amber-300 transition">
                  Our Roasting Philosophy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-amber-300 transition">
                  Location &amp; Directions
                </Link>
              </li>
            </ul>
          </div>

          {/* Hours & Ambiance */}
          <div>
            <h4 className="font-serif text-base font-semibold text-white mb-4">
              Hours &amp; Ambiance
            </h4>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <span>{DEMO_SETTINGS.openingHours}</span>
              </li>
              <li className="text-xs text-zinc-400 leading-normal">
                Pet-friendly outdoor courtyard &bull; High-speed guest Wi-Fi &bull; Quiet indoor mezzanine for remote work.
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="font-serif text-base font-semibold text-white mb-4">
              Visit Us
            </h4>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <span>
                  {DEMO_SETTINGS.address}, {DEMO_SETTINGS.city} – {DEMO_SETTINGS.postalCode}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{DEMO_SETTINGS.phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{DEMO_SETTINGS.email}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-zinc-800/80 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>
            &copy; {new Date().getFullYear()} {DEMO_SETTINGS.brandName}. All rights reserved.
          </p>
          <p className="flex items-center gap-1">
            Crafted for <span className="text-zinc-300 font-medium">The Business Work</span> platform
          </p>
        </div>
      </div>
    </footer>
  );
}

