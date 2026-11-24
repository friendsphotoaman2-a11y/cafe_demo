'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Phone,
  FileSpreadsheet,
  Users,
  Award,
  IndianRupee,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiUrl } from '@/lib/base-path';
import { formatSheetDate } from '@/lib/date-utils';

interface CustomerRecord {
  phone: string;
  name: string;
  visit_count: number;
  first_visit: string;
  last_visit: string;
  total_spent: number;
}

export function CustomersView() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sheetConnected, setSheetConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cacheAgeSec, setCacheAgeSec] = useState<number | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    mode: 'single' | 'all';
    phone?: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(
    async (isRefresh = false, silent = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!silent) setLoading(true);
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        if (isRefresh) params.set('refresh', 'true');
        if (searchQuery.trim()) params.set('q', searchQuery.trim());

        const res = await fetch(apiUrl(`/api/manager/customers?${params.toString()}`));
        const data = await res.json();

        if (data.success) {
          setCustomers(data.customers || []);
          setSheetConnected(data.sheetConnected !== false);
          if (data.cacheAgeSec !== undefined) setCacheAgeSec(data.cacheAgeSec);
        } else {
          setSheetConnected(false);
          setCustomers([]);
          setErrorMsg(data.message || 'Failed to load customers from Google Sheet.');
        }
      } catch {
        setErrorMsg('Network error loading customer directory.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Realtime sync every 15s when visible + instant sync on tab focus
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchCustomers(true, true);
    };
    document.addEventListener('visibilitychange', onVis);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchCustomers(true, true);
    }, 15000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(interval);
    };
  }, [fetchCustomers]);

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setErrorMsg(null);

    try {
      const payload =
        confirmDelete.mode === 'all' ? { clearAll: true } : { phone: confirmDelete.phone };
      const res = await fetch(apiUrl('/api/manager/customers'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Failed to delete customer from Google Sheet.');
      } else {
        setConfirmDelete(null);
        await fetchCustomers(true, true);
      }
    } catch {
      setErrorMsg('Network error while deleting customer.');
    } finally {
      setDeleting(false);
    }
  }

  function handleExportCSV() {
    if (customers.length === 0) return;

    const headers = [
      'Phone Number',
      'Customer Name',
      'Total Visits',
      'First Visit',
      'Last Visit',
      'Total Spent (INR)',
    ];

    const csvRows = customers.map(c => [
      `"${c.phone}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      c.visit_count,
      `"${c.first_visit}"`,
      `"${c.last_visit}"`,
      c.total_spent,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const regularCustomersCount = customers.filter(c => c.visit_count >= 3).length;
  const totalCustomerSpend = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight">Customer Directory &amp; Loyalty</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                sheetConnected
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-950/80 text-red-400 border-red-500/30'
              }`}
            >
              {sheetConnected ? 'Live • Google Sheets' : 'Sheet Disconnected'}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Synced directly from your Google Sheet Customers tab with real-time updates &amp; delete.
            {cacheAgeSec !== null && (
              <span className="ml-1 text-stone-500 font-mono">(Synced {cacheAgeSec}s ago)</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchCustomers(true)}
            disabled={refreshing || loading}
            className="min-h-[40px] py-2 px-3.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-white active:scale-95 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Sheet</span>
          </button>

          {customers.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmDelete({
                  mode: 'all',
                  label: `Delete ALL ${customers.length} customers from Google Sheets?`,
                })
              }
              className="min-h-[40px] py-2 px-3.5 rounded-xl bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-red-300 active:scale-95 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Sheet</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={customers.length === 0}
            className="min-h-[40px] py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between animate-fade-in-up">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
              Customers Shown
            </span>
            <span className="text-2xl font-black font-mono text-white mt-0.5 block">
              {customers.length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between animate-fade-in-up">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
              Repeat Regulars (3+ Visits)
            </span>
            <span className="text-2xl font-black font-mono text-amber-400 mt-0.5 block">
              {regularCustomersCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between animate-fade-in-up">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
              Combined Spend
            </span>
            <span className="text-2xl font-black font-mono text-emerald-400 mt-0.5 block">
              ₹{totalCustomerSpend.toFixed(0)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by 10-digit Phone or Customer Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 animate-shake">
          {errorMsg}
        </div>
      )}

      {/* Customers Card Grid (Mobile) & Table (Desktop) */}
      <div className="rounded-3xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-16 rounded-2xl animate-shimmer-dark border border-stone-800/60" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-14 px-6 text-center text-stone-500">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2.5 opacity-30" />
            <p className="font-bold text-sm text-stone-300">No customers in Google Sheet.</p>
            <p className="text-xs text-stone-500 mt-1">
              Customers appear here automatically when bills are settled with phone numbers.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile / Tablet Card View */}
            <div className="md:hidden divide-y divide-stone-800/80">
              {customers.map((c, idx) => (
                <div
                  key={c.phone || idx}
                  style={{ animationDelay: `${Math.min(idx * 35, 200)}ms` }}
                  className="p-4 space-y-2.5 animate-fade-in-up"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">
                        {(c.name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white truncate">{c.name}</h4>
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 font-mono text-xs text-stone-400 hover:text-amber-300 mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{c.phone}</span>
                        </a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-emerald-400 font-mono text-base block">
                        ₹{c.total_spent}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold font-mono text-[10px]">
                        {c.visit_count} {c.visit_count === 1 ? 'Visit' : 'Visits'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-stone-500 pt-1">
                    <div>
                      <span>
                        First: {formatSheetDate(c.first_visit)}
                      </span>
                      <span className="text-stone-400 ml-2">
                        Last: {formatSheetDate(c.last_visit)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          mode: 'single',
                          phone: c.phone,
                          label: `Delete customer ${c.name} (${c.phone}) from Google Sheets?`,
                        })
                      }
                      className="p-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition cursor-pointer"
                      title="Delete customer from Google Sheet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-[11px] text-stone-400 uppercase font-bold bg-stone-900/90">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-3 font-mono">Phone Number</th>
                    <th className="py-3 px-3">Total Visits</th>
                    <th className="py-3 px-3">First Visit</th>
                    <th className="py-3 px-3">Last Visit</th>
                    <th className="py-3 px-3 text-right">Lifetime Spend</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/50">
                  {customers.map((c, idx) => (
                    <tr key={c.phone || idx} className="hover:bg-stone-900/80 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{c.name}</td>
                      <td className="py-3.5 px-3 font-mono text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-stone-500" />
                          <span>{c.phone}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px]">
                          {c.visit_count} {c.visit_count === 1 ? 'Visit' : 'Visits'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-stone-400 text-xs font-mono">
                        {formatSheetDate(c.first_visit)}
                      </td>
                      <td className="py-3.5 px-3 text-stone-300 text-xs font-mono">
                        {formatSheetDate(c.last_visit)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-black text-emerald-400 font-mono text-sm">
                        ₹{c.total_spent}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              mode: 'single',
                              phone: c.phone,
                              label: `Delete customer ${c.name} (${c.phone}) from Google Sheets?`,
                            })
                          }
                          className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition cursor-pointer"
                          title="Delete customer from Google Sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          onClick={() => !deleting && setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-stone-900 border border-red-900/60 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-4 animate-slide-up sm:animate-scale-up"
          >
            <div className="w-10 h-1 rounded-full bg-stone-700 mx-auto -mt-1 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-950/80 text-red-400 border border-red-800/60 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Customer</h3>
                <p className="text-xs text-stone-400">
                  This removes the row directly from your Google Sheet Customers tab.
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-200 bg-stone-950 p-3.5 rounded-2xl border border-stone-800 leading-relaxed">
              {confirmDelete.label}
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
