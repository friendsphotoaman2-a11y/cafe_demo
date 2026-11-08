"use client";

import React from "react";
import { LogOut, User, QrCode } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface ControlRoomHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function ControlRoomHeader({
  title,
  subtitle,
  actions,
}: ControlRoomHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-zinc-200/90 bg-white px-5 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-zinc-950 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {actions}

          {/* Active staff user pill */}
          {user && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-xs shadow-2xs">
              <User className="h-3.5 w-3.5 text-amber-600" />
              <div className="leading-tight">
                <span className="font-bold text-zinc-900 block truncate max-w-[120px]">
                  {user.fullName}
                </span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-tight">
                  {user.role}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="ml-1 text-zinc-400 hover:text-red-600 p-1 rounded-lg"
                title="Sign out of Control Room"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Floor & Table QR codes management shortcut */}
          <Link
            href="/controlroom/tables"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 transition shadow-xs"
          >
            <QrCode className="h-3.5 w-3.5 text-amber-300" />
            <span>Tables</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
