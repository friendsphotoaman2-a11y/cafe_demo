"use client";

import React, { useEffect, useState } from "react";
import { Database, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiUrl } from "@/lib/base-path";

export default function DemoNoticeBanner() {
  const { user } = useAuth();
  const [dbState, setDbState] = useState<{
    statusText: string;
    isMigrated: boolean;
    isConnected: boolean;
  }>({
    statusText: "Probing Supabase...",
    isMigrated: false,
    isConnected: false,
  });

  useEffect(() => {
    fetch(apiUrl("/api/supabase/status"))
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.migrated) {
          setDbState({
            statusText: "Cloud DB Verified (All 19 Tables Active)",
            isMigrated: true,
            isConnected: true,
          });
        } else if (data.connected && !data.migrated) {
          setDbState({
            statusText: "Supabase Connected — Migrations Pending in SQL Editor",
            isMigrated: false,
            isConnected: true,
          });
        } else {
          setDbState({
            statusText: "Cloud Connection Pending",
            isMigrated: false,
            isConnected: false,
          });
        }
      })
      .catch(() => {
        setDbState({
          statusText: "Local Resilient Mode",
          isMigrated: false,
          isConnected: false,
        });
      });
  }, []);

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-2 w-2 rounded-full ${
            dbState.isMigrated
              ? "bg-emerald-500 animate-pulse"
              : dbState.isConnected
              ? "bg-amber-500 animate-pulse"
              : "bg-zinc-400"
          }`}
        />
        <span className="font-bold">Cloud Database &amp; Operations Engine:</span>
        <span className="text-zinc-700 hidden sm:inline">
          Server Auth Guard &bull; {dbState.statusText}
        </span>
      </div>

      <div className="flex items-center gap-3 font-semibold text-xs text-zinc-700">
        {user && (
          <span className="flex items-center gap-1 rounded bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
            <ShieldCheck className="h-3 w-3" />
            {user.role.toUpperCase()}
          </span>
        )}

        <div className="flex items-center gap-1.5 text-zinc-600">
          <Database className="h-3.5 w-3.5 text-amber-600" />
          <span>Cross-Device Bus</span>
        </div>
      </div>
    </div>
  );
}
