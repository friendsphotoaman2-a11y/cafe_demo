"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function ControlRoomSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  // Load collapse preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tbw_sidebar_collapsed");
      if (stored === "true") setIsCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("tbw_sidebar_collapsed", String(next));
    } catch {}
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/controlroom",
      icon: LayoutDashboard,
      roles: ["owner", "manager", "cashier", "kitchen"],
    },
    {
      label: "Tables Live",
      href: "/controlroom/tables",
      icon: Grid,
      roles: ["owner", "manager"],
    },
    {
      label: "Orders Hub",
      href: "/controlroom/orders",
      icon: ShoppingBag,
      roles: ["owner", "manager", "cashier", "kitchen"],
    },
    {
      label: "Kitchen KDS",
      href: "/controlroom/kitchen",
      icon: ChefHat,
      roles: ["owner", "manager", "kitchen"],
    },
    {
      label: "Counter Cashier",
      href: "/controlroom/cashier",
      icon: ReceiptText,
      roles: ["owner", "manager", "cashier"],
    },
    {
      label: "Customers CRM",
      href: "/controlroom/customers",
      icon: Users,
      roles: ["owner", "manager", "cashier"],
    },
    {
      label: "Loyalty Rewards",
      href: "/controlroom/loyalty",
      icon: Award,
      roles: ["owner", "manager", "cashier"],
    },
    {
      label: "Menu Catalog",
      href: "/controlroom/menu",
      icon: UtensilsCrossed,
      roles: ["owner", "manager"],
    },
    {
      label: "Café Settings",
      href: "/controlroom/settings",
      icon: Settings,
      roles: ["owner"],
    },
  ];

  const sidebarContent = (
    <div
      className={`flex h-full flex-col justify-between bg-zinc-950 text-zinc-300 p-3.5 border-r border-zinc-800 transition-all duration-300 select-none ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <div>
        {/* Brand & Collapse Header */}
        <div className="flex items-center justify-between px-1 py-3 mb-3 border-b border-zinc-800/80">
          <Link
            href="/controlroom"
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-bold shadow-md shrink-0">
              <Coffee className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="leading-tight truncate">
                <span className="font-serif text-sm font-bold text-white block truncate">
                  Brew &amp; Bean
                </span>
                <span className="text-[10px] tracking-wider uppercase text-amber-400 font-semibold">
                  Control Room
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={toggleCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Current Active Staff User Pill */}
        {user && !isCollapsed && (
          <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2.5 flex items-center justify-between text-xs">
            <div className="leading-tight truncate">
              <span className="font-bold text-white block truncate max-w-[130px]">
                {user.fullName}
              </span>
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                {user.role}
              </span>
            </div>
            <Link
              href="/controlroom/login"
              className="text-[10px] text-zinc-400 hover:text-white underline"
            >
              Switch
            </Link>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/controlroom"
                ? pathname === "/controlroom"
                : pathname?.startsWith(item.href);

            const Icon = item.icon;
            const isPermitted =
              !user || user.role === "owner" || item.roles.includes(user.role);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-amber-400 text-zinc-950 font-bold shadow-xs"
                    : isPermitted
                    ? "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    : "text-zinc-600 hover:bg-zinc-900/40 cursor-not-allowed"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 ${
                      isActive
                        ? "text-zinc-950"
                        : isPermitted
                        ? "text-zinc-400"
                        : "text-zinc-600"
                    }`}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && !isPermitted && (
                  <Lock className="h-3 w-3 text-zinc-600" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Pill & Staff Auth */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
        <Link
          href="/controlroom/login"
          title="Staff Portal Sign In"
          className={`w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition ${
            isCollapsed ? "px-0" : "px-3"
          }`}
        >
          <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          {!isCollapsed && <span>Staff Switch</span>}
        </Link>

        {!isCollapsed && (
          <Link
            href="/"
            target="_blank"
            className="w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 transition"
          >
            <span>Public Ordering Site</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-30 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Top Bar */}
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
