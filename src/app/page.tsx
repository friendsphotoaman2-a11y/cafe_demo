import Link from 'next/link';
import { OAuthCallbackRedirect } from '@/components/OAuthCallbackRedirect';
import {
  ShieldCheck,
  ChefHat,
  Coffee,
  Smartphone,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';

export default function Home() {
  const sampleTables = [
    { name: 'Table 1', code: 't1' },
    { name: 'Table 2', code: 't2' },
    { name: 'Table 3', code: 't3' },
    { name: 'Table 4', code: 't4' },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <OAuthCallbackRedirect />
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20">
              ☕
            </div>
            <div>
              <h1 className="font-black text-lg text-white tracking-tight">Brew &amp; Bites</h1>
              <p className="text-xs text-amber-300 font-medium">Smart Table Ordering &amp; POS</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/manager"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Manager Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built for Modern Cafes in India</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Smart Table QR Ordering, Live KDS &amp; Counter Billing
          </h2>
          <p className="text-stone-400 text-sm mt-3 leading-relaxed">
            Customers scan table QR/NFC, unlock with a 4-digit manager PIN, and order live.
            Manager bills at the counter, syncs data to Google Sheets, and rewards loyal coffee lovers.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Customer Experience */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Table Ordering</h3>
              <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                4-digit PIN protected table session with 5-attempt 5-minute lockout. Realtime shared
                order list (&quot;Your order&quot; vs &quot;Others at table&quot;) and Call Waiter button.
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
                Simulate Customer Table:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {sampleTables.map(t => (
                  <Link
                    key={t.code}
                    href={`/t/${t.code}`}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-semibold text-xs text-center border border-stone-700 transition"
                  >
                    Open {t.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Manager Portal */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Manager &amp; Counter POS</h3>
              <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                Google login allowlist, PIN generation, audio waiter call alerts, one-click menu availability,
                thermal receipt printing (58mm/80mm), and PDF invoices.
              </p>
            </div>

            <Link
              href="/manager"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <span>Go to Manager Hub</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Kitchen Display */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4 border border-orange-500/20">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Kitchen Display (KDS)</h3>
              <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                Real-time tablet-friendly screen showing tickets (Pending, Cooking, Ready). Can be
                turned ON or OFF in Manager Settings.
              </p>
            </div>

            <Link
              href="/kitchen"
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 border border-stone-700 transition"
            >
              <span>Open Kitchen Screen</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Loyalty & Sheets Highlights */}
        <div className="bg-linear-to-r from-amber-950/40 via-stone-900 to-amber-950/40 border border-amber-900/30 rounded-3xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Loyalty Program</h4>
                <p className="text-xs text-stone-400 mt-0.5">
                  Tracks customer phone numbers. Every 5 visits rewards a Free Coffee on the next visit
                  (visit 6, 11, 16...). Clearly highlighted on invoice.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Google Sheets &amp; 30-Day Retention</h4>
                <p className="text-xs text-stone-400 mt-0.5">
                  Synchronizes every settled bill into <code>Orders</code>, <code>OrderItems</code>, and{' '}
                  <code>Customers</code> tabs. Supabase retains only 30 days of closed bills.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-900 bg-stone-950 py-4 px-6 text-center text-xs text-stone-600">
        Brew &amp; Bites Smart Cafe System • Next.js, Supabase, Tailwind CSS &amp; Google Sheets API
      </footer>
    </div>
  );
}
