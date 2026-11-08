"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coffee,
  QrCode,
  Menu as MenuIcon,
  X,
  User,
  UtensilsCrossed,
  BookOpen,
  MapPin,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import QrScannerModal from "./QrScannerModal";

export default function Navbar() {
  const pathname = usePathname();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "/", icon: Coffee },
    { label: "Digital Menu", href: "/menu", icon: UtensilsCrossed },
    { label: "My Profile", href: "/profile", icon: User },
    { label: "Our Story", href: "/about", icon: BookOpen },
    { label: "Visit & Contact", href: "/contact", icon: MapPin },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-amber-900/10 bg-[#FAF7F2]/90 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-18 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-amber-950 text-amber-300 shadow-md ring-1 ring-amber-400/20 transition-transform group-hover:scale-105">
              <Coffee className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl font-black tracking-tight text-zinc-900 group-hover:text-amber-900 transition-colors">
                Brew &amp; Bean
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-amber-800/80">
                Artisan Roastery &bull; Indiranagar
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/70 p-1.5 rounded-full border border-amber-900/10 shadow-xs">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-zinc-900 text-amber-300 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Table QR button */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-black text-zinc-950 shadow-md hover:from-amber-400 hover:to-amber-500 hover:shadow-lg transition-all active:scale-95"
            >
              <QrCode className="h-4 w-4 transition-transform group-hover:rotate-12" />
              <span>Order at Table</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile Right Actions */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-2 text-xs font-black text-zinc-950 shadow-sm active:scale-95 transition"
              aria-label="Scan Table QR"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Table QR</span>
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-2xl p-2.5 text-zinc-800 bg-white/80 border border-zinc-200/80 hover:bg-white transition"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu with Drawer effect */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-b border-amber-900/10 bg-[#FAF7F2]/98 backdrop-blur-2xl px-5 pt-3 pb-6 shadow-2xl animate-fade-in space-y-4">
            <div className="flex flex-col space-y-1.5">
              {navLinks.map((link) => {
                const IconComponent = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                      isActive
                        ? "bg-zinc-900 text-amber-300 shadow-sm"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <IconComponent className={`h-4 w-4 ${isActive ? "text-amber-300" : "text-zinc-400"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Table QR Banner */}
            <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-amber-950 p-4 text-white space-y-2.5 shadow-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">Dining at Brew &amp; Bean?</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Scan the QR code on your table badge to order directly without waiting for a waiter.
              </p>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsQrModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-zinc-950 hover:bg-amber-300 transition"
              >
                <QrCode className="h-4 w-4" />
                <span>Launch QR Table Scanner</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </>
  );
}
