"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, QrCode, Menu as MenuIcon, X } from "lucide-react";
import QrScannerModal from "./QrScannerModal";

export default function Navbar() {
  const pathname = usePathname();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Digital Menu", href: "/menu" },
    { label: "Our Story", href: "/about" },
    { label: "Visit & Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-cafe-200/60 bg-[#FAF7F2]/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Brand */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cafe-900 text-amber-300 shadow-md transition-transform group-hover:scale-105">
              <Coffee className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl font-bold tracking-tight text-cafe-950 sm:text-2xl">
                Brew &amp; Bean
              </span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-cafe-600">
                Café &bull; Artisan Roastery
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium tracking-wide transition-colors ${
                    isActive
                      ? "text-cafe-900 font-semibold border-b-2 border-cafe-800 pb-0.5"
                      : "text-zinc-600 hover:text-cafe-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Scan Table QR */}
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-cafe-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cafe-800 hover:shadow-lg transition active:scale-95"
            >
              <QrCode className="h-4 w-4 text-amber-300" />
              <span>Scan Table QR</span>
            </button>
          </div>

          {/* Mobile Menu & Scanner Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-cafe-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm"
              aria-label="Scan Table QR"
            >
              <QrCode className="h-3.5 w-3.5 text-amber-300" />
              <span>Table QR</span>
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-xl p-2 text-cafe-900 hover:bg-cafe-200/50 transition"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-cafe-200 bg-[#FAF7F2] px-4 pt-3 pb-6 shadow-xl animate-fade-in">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-base font-medium transition ${
                    pathname === link.href
                      ? "bg-cafe-200 text-cafe-950 font-semibold"
                      : "text-zinc-700 hover:bg-cafe-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
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

