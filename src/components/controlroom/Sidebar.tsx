"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Grid,
  UtensilsCrossed,
  ShoppingBag,
  ChefHat,
  ReceiptText,
  Users,
  Award,
  Settings,
  Lock,
  Coffee,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

export default function ControlRoomSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/controlroom", icon: LayoutDashboard },
    { label: "Tables Live", href: "/controlroom/tables", icon: Grid },
    { label: "Menu Catalog", href: "/controlroom/menu", icon: UtensilsCrossed },
    { label: "Orders Hub", href: "/controlroom/orders", icon: ShoppingBag },
    { label: "Kitchen Kanban", href: "/controlroom/kitchen", icon: ChefHat },
    { label: "Counter Cashier", href: "/controlroom/cashier", icon: ReceiptText },
    { label: "Customers", href: "/controlroom/customers", icon: Users },
    { label: "Loyalty 5-Stamps", href: "/controlroom/loyalty", icon: Award },
    { label: "Café Settings", href: "/controlroom/settings", icon: Settings },
    { label: "Staff Login Preview", href: "/controlroom/login", icon: Lock },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-zinc-950 text-zinc-300 p-4 border-r border-zinc-800">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-4 mb-4 border-b border-zinc-800/80">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-bold shadow-md">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <span className="font-serif text-base font-bold text-white block">
              Brew &amp; Bean
            </span>
            <span className="text-[10px] tracking-wider uppercase text-amber-400 font-semibold">
              Control Room &bull; HQ
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/controlroom"
                ? pathname === "/controlroom"
                : pathname?.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-amber-400 text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-zinc-950" : "text-zinc-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Pill */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400">
          <Sparkles className="h-3 w-3" />
          <span>The Business Work</span>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">
          Café SaaS Architecture &bull; Phase 1
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (w-64) */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Bar & Drawer Toggle */}
      <div className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-white">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-400" />
          <span className="font-serif text-sm font-bold">Control Room HQ</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          aria-label="Toggle Menu"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-64 max-w-xs h-full z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

