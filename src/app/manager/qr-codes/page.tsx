'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, ManagerSettings } from '@/types/database';
import { apiUrl } from '@/lib/base-path';
import { TableQRCodesView } from '@/components/TableQRCodesView';
import { ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import Link from 'next/link';

export default function ManagerQRCodesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [settings, setSettings] = useState<ManagerSettings>({
    id: 1,
    cafe_name: 'Brew & Bites Cafe',
    cafe_tagline: 'Freshly Brewed & Baked',
    cafe_address: '123 MG Road, Bengaluru',
    cafe_phone: '+91 98765 43210',
    cafe_email: 'contact@brewandbites.in',
    gst_number: '29ABCDE1234F1Z5',
    tax_enabled: true,
    gst_rate_percent: 5.0,
    receipt_paper_size: '58mm',
    session_hours: 2,
    loyalty_every_n_visits: 5,
    order_id_prefix: 'CF-',
    kitchen_screen_enabled: true,
    google_sheet_id: '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY',
    updated_at: new Date().toISOString(),
  });

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const isDevMode = process.env.NODE_ENV === 'development';

      // 1. Auth check
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const res = await fetch(apiUrl('/api/manager/auth/check'));
          const data = await res.json();
          if (!data.allowed && !isDevMode) {
            router.replace('/manager/login?error=not_allowed');
            return;
          }
        } catch {
          // Dev fallback
        }
      } else if (!isDevMode) {
        router.replace('/manager/login');
        return;
      }

      // 2 & 3. Fetch tables and settings in parallel
      const [{ data: tblData }, { data: setRow }] = await Promise.all([
        supabase.from('cafe_tables').select('*').order('table_number', { ascending: true }),
        supabase.from('manager_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (tblData) {
        setTables(tblData as CafeTable[]);
      }

      if (setRow) {
        setSettings(prev => ({
          ...prev,
          ...setRow,
        }));
      }

      setLoading(false);
    }

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400 gap-3 font-mono text-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
        <span>Loading Table QR Codes &amp; Stands...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Top Header Bar (Hidden during print) */}
      <header className="no-print bg-stone-950/80 backdrop-blur-md border-b border-stone-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/manager"
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Manager Hub</span>
          </Link>
          <div className="h-4 w-px bg-stone-800" />
          <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
            Table QR Codes &amp; 4x6 Acrylic Stands
          </h1>
        </div>

        <button
          onClick={() => window.print()}
          className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Print All Stand Cards (A4)</span>
          <span className="sm:hidden">Print</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        <TableQRCodesView tables={tables} settings={settings} />
      </main>
    </div>
  );
}
