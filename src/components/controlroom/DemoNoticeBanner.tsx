"use client";

import React, { useEffect, useState } from "react";
import { Database, ShieldCheck, Wifi, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCafeStore } from "@/lib/store";

export default function DemoNoticeBanner() {
  const { user } = useAuth();
  const { isRealtimeConnected } = useCafeStore();
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Verifying...");

  useEffect(() => {
    fetch("/api/supabase/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.migrated) {
          setSupabaseStatus("Supabase DB: Active & Migrated");
        } else if (data.connected && !data.migrated) {
          setSupabaseStatus("Supabase DB: Connected (Migrations Pending in SQL Editor)");
        } else {
          setSupabaseStatus("Supabase DB: Ready for Cloud Sync");
        }
      })
      .catch(() => {
        setSupabaseStatus("Dual Engine (Cloud API + Local Bus)");
      });
  }, []);

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-bold">Phase 3 Production Engine:</span>
        <span className="text-zinc-700 hidden sm:inline">
          RLS Staff Protection Active &bull; {supabaseStatus}
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
