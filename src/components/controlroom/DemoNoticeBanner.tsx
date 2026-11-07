import React from "react";
import { AlertTriangle, Database } from "lucide-react";

export default function DemoNoticeBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-900 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-bold">Control Room Phase 1 Preview:</span>
        <span className="text-zinc-700">
          Loaded from centralized typed fixtures. Full Supabase realtime and protected staff auth will connect in Phase 2 &amp; 3.
        </span>
      </div>
      <div className="flex items-center gap-1.5 font-medium text-amber-800">
        <Database className="h-3.5 w-3.5" />
        <span>Fictional Demo Layer</span>
      </div>
    </div>
  );
}

