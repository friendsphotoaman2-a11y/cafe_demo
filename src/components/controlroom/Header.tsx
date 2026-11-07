"use client";

import React from "react";
import { ExternalLink, LogOut, User, QrCode } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface ControlRoomHeaderProps {
  title: string;
  subtitle?: string;
}

export default function ControlRoomHeader({
  title,
  subtitle,
}: ControlRoomHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-zinc-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Active staff user pill */}
          {user && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-amber-600" />
              <div className="leading-tight">
                <span className="font-bold text-zinc-900 block truncate max-w-[130px]">
                  {user.fullName}
                </span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                  {user.role}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="ml-2 text-zinc-400 hover:text-red-600 p-1 rounded-lg"
                title="Sign out of Control Room"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick link to live public site */}
          <Link
            href="/"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
          >
            <span>Public Site</span>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>

          {/* Floor & Table QR codes management */}
          <Link
            href="/controlroom/tables"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
          >
            <QrCode className="h-3.5 w-3.5 text-amber-300" />
            <span>Manage Tables</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
