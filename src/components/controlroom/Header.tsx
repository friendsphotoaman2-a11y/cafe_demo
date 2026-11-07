"use client";

import React from "react";
import { Search, Bell, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface ControlRoomHeaderProps {
  title: string;
  subtitle?: string;
}

export default function ControlRoomHeader({
  title,
  subtitle,
}: ControlRoomHeaderProps) {
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

        <div className="flex items-center gap-3">
          {/* Quick link to live public site */}
          <Link
            href="/"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
          >
            <span>View Public Site</span>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>

          {/* Table 01 test quick link */}
          <Link
            href="/t/01"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
          >
            <span>Table 01 QR View</span>
            <ExternalLink className="h-3.5 w-3.5 text-amber-300" />
          </Link>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Store Open</span>
          </div>
        </div>
      </div>
    </header>
  );
}

