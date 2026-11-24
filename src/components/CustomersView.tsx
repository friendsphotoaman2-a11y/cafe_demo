'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Phone,
  FileSpreadsheet,
} from 'lucide-react';
import { apiUrl } from '@/lib/base-path';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [cacheAgeSec, setCacheAgeSec] = useState<number | null>(null);

  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      if (isRefresh) params.set('refresh', 'true');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(apiUrl(`/api/manager/customers?${params.toString()}`));
      const data = await res.json();

      if (data.success) {
        setCustomers(data.customers || []);
        if (data.cacheAgeSec !== undefined) setCacheAgeSec(data.cacheAgeSec);
      } else {
        setErrorMsg(data.message || 'Failed to load customers from Google Sheet.');
      }
    } catch {
      setErrorMsg('Network error loading customer directory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight">Customer Directory &amp; Loyalty</h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-500/30 text-[10px] font-bold font-mono">
              Google Sheets Synced
            </span>
          </div>
          <p className="text-xs text-stone-400">
            All registered cafe customers with visit counts, lifetime spend, and CSV export.
            {cacheAgeSec !== null && (
              <span className="ml-1 text-stone-500 font-mono">
                (Sheet cached {cacheAgeSec}s ago)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => fetchCustomers(true)}
            disabled={refreshing || loading}
            className="py-2 px-3 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={customers.length === 0}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by 10-digit Phone or Customer Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Customers Table */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-800 text-[11px] text-stone-400 uppercase font-bold bg-stone-900/90">
                <th className="py-2.5 px-3.5">Customer Name</th>
                <th className="py-2.5 px-3 font-mono">Phone Number</th>
                <th className="py-2.5 px-3">Total Visits</th>
                <th className="py-2.5 px-3">First Visit</th>
                <th className="py-2.5 px-3">Last Visit</th>
                <th className="py-2.5 px-3.5 text-right">Lifetime Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading customers from Google Sheets...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-stone-400">No customer records found.</p>
                    <p className="text-xs text-stone-600 mt-1">Customers are recorded when billing with phone numbers.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr key={c.phone || idx} className="hover:bg-stone-900/80 transition">
                    <td className="py-3 px-3.5 font-bold text-white">
                      {c.name}
                    </td>
                    <td className="py-3 px-3 font-mono text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-stone-500" />
                        <span>{c.phone}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px]">
                        {c.visit_count} {c.visit_count === 1 ? 'Visit' : 'Visits'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-400 text-xs font-mono">
                      {c.first_visit ? new Date(c.first_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-stone-300 text-xs font-mono">
                      {c.last_visit ? new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-black text-emerald-400 font-mono text-sm">
                      ₹{c.total_spent}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
