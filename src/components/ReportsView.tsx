'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  ExternalLink,
  Calendar,
  Coffee,
  Table as TableIcon,
  RefreshCw,
  Award,
  AlertCircle,
} from 'lucide-react';
import { ManagerSettings } from '@/types/database';
import { DailySalesRecord, TableSalesRecord, BestSellingItemRecord } from '@/app/api/manager/reports/route';
import { apiUrl } from '@/lib/base-path';

interface ReportsData {
  success: boolean;
  source: string;
  note: string;
  google_sheet_id: string;
  range: string;
  summary: {
    total_sales: number;
    bills_count: number;
    average_bill: number;
    total_tax: number;
    total_discount: number;
  };
  daily_sales: DailySalesRecord[];
  table_sales: TableSalesRecord[];
  best_selling_items: BestSellingItemRecord[];
}

interface Props {
  settings: ManagerSettings;
}

export function ReportsView({ settings }: Props) {
  const [range, setRange] = useState<'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom'>('last_7_days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/manager/reports?range=${range}`;
      if (range === 'custom') {
        if (customFrom) url += `&from=${customFrom}`;
        if (customTo) url += `&to=${customTo}`;
      }
      const res = await fetch(apiUrl(url));
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.message || 'Failed to load reports.');
      }
    } catch {
      setError('Network error while loading reports.');
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const sheetId = data?.google_sheet_id || settings.google_sheet_id || '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY';

  return (
    <div className="space-y-6">
      {/* Top Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span>Sales Reports &amp; Analytics</span>
          </h2>
          <p className="text-xs text-stone-400">
            Daily sales breakdown, best-selling dishes, and table turnover from Supabase (last 30 days).
          </p>
        </div>

        {/* Date Range Selector Pills */}
        <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 p-1 rounded-2xl flex-wrap">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last_7_days', label: 'Last 7 Days' },
              { id: 'last_30_days', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom' },
            ] as const
          ).map(p => (
            <button
              key={p.id}
              onClick={() => setRange(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                range === p.id
                  ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={fetchReports}
            className="p-1.5 text-stone-400 hover:text-amber-400 rounded-xl hover:bg-stone-800 transition cursor-pointer"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {range === 'custom' && (
        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
          <span className="text-stone-400 font-semibold flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" /> Date Filter:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-stone-400 text-[11px]">From:</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-white font-mono text-xs focus:outline-hidden focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-stone-400 text-[11px]">To:</label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-white font-mono text-xs focus:outline-hidden focus:border-amber-500"
            />
          </div>
          <button
            onClick={fetchReports}
            className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {/* Notice Banner: 30-day Supabase vs Google Sheets Archive */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Live Data from Supabase (Last 30 Days)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Connected
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Showing active 30-day records. Older historical records live permanently in the Google Sheet archive.
            </p>
          </div>
        </div>

        <a
          href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
          target="_blank"
          rel="noreferrer"
          className="py-2 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-stone-700 transition shrink-0 cursor-pointer"
        >
          <span>Open Google Sheet Archive</span>
          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
        </a>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center gap-3 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Daily Sales Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-3xl font-black font-mono text-white block">
            ₹{data?.summary.total_sales ?? 0}
          </span>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
            <TrendingUp className="w-3 h-3" /> Net revenue in period
          </span>
        </div>

        {/* Number of Bills */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Number of Bills</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <span className="text-3xl font-black font-mono text-white block">
            {data?.summary.bills_count ?? 0}
          </span>
          <span className="text-[11px] text-stone-400 block mt-1">
            Settled counter bills
          </span>
        </div>

        {/* Average Bill */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Bill</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <span className="text-3xl font-black font-mono text-white block">
            ₹{data?.summary.average_bill ?? 0}
          </span>
          <span className="text-[11px] text-purple-300 block mt-1">
            Avg spend per table bill
          </span>
        </div>

        {/* Tax & Discount */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">GST Tax &amp; Loyalty</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-400">
              +₹{data?.summary.total_tax ?? 0}
            </span>
            <span className="text-xs text-stone-500">GST</span>
          </div>
          <span className="text-[11px] text-stone-400 block mt-1">
            Discount given: ₹{data?.summary.total_discount ?? 0}
          </span>
        </div>
      </div>

      {/* 2. Grid: Best-Selling Items & Table-Wise Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best-Selling Items for chosen date range */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-sm text-white uppercase tracking-wider">
                Best-Selling Items
              </h3>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              {data?.best_selling_items.length ?? 0} dishes ordered
            </span>
          </div>

          <div className="space-y-3">
            {data?.best_selling_items.map((item, idx) => (
              <div
                key={item.name_en}
                className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      idx === 0
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : idx === 1
                        ? 'bg-stone-300 text-stone-900 font-black'
                        : idx === 2
                        ? 'bg-amber-700 text-stone-100 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    #{item.rank}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-white truncate">{item.name_en}</h4>
                    {item.name_hi && (
                      <span className="text-[10px] text-stone-400 truncate block">
                        {item.name_hi}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-xs text-white block">
                    {item.quantity} sold
                  </span>
                  <span className="text-[11px] font-mono text-amber-400 font-bold block">
                    ₹{item.revenue}
                  </span>
                </div>
              </div>
            ))}

            {(!data?.best_selling_items || data.best_selling_items.length === 0) && (
              <div className="py-8 text-center text-stone-500 text-xs">
                <Coffee className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No item orders in this date range yet.
              </div>
            )}
          </div>
        </div>

        {/* Table-Wise Sales Breakdown */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-sm text-white uppercase tracking-wider">
                Table-Wise Sales
              </h3>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              {data?.table_sales.length ?? 0} active tables
            </span>
          </div>

          <div className="space-y-3">
            {data?.table_sales.map(tbl => (
              <div
                key={tbl.table_number}
                className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-white">{tbl.table_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-mono">
                      {tbl.bills_count} {tbl.bills_count === 1 ? 'bill' : 'bills'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-xs text-amber-400">
                      ₹{tbl.total_sales}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono block">
                      Avg ₹{tbl.average_bill}
                    </span>
                  </div>
                </div>

                {/* Percentage progress bar */}
                <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, tbl.percentage)}%` }}
                  />
                </div>
              </div>
            ))}

            {(!data?.table_sales || data.table_sales.length === 0) && (
              <div className="py-8 text-center text-stone-500 text-xs">
                <TableIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No table billing activity recorded in this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Daily Sales Breakdown Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-white uppercase tracking-wider">
              Daily Sales Trend
            </h3>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">
            {data?.daily_sales.length ?? 0} days recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-stone-400 font-mono text-[11px] uppercase border-b border-stone-800">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Day</th>
                <th className="p-4">Bills Count</th>
                <th className="p-4">Total Revenue</th>
                <th className="p-4">Average Bill Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 font-mono">
              {data?.daily_sales.map(day => (
                <tr key={day.date} className="hover:bg-stone-800/40 transition">
                  <td className="p-4 font-bold text-white">{day.date}</td>
                  <td className="p-4 text-stone-400">{day.day_label}</td>
                  <td className="p-4 font-bold">{day.bills_count}</td>
                  <td className="p-4 font-black text-amber-400">₹{day.total_sales}</td>
                  <td className="p-4 text-stone-300">₹{day.average_bill}</td>
                </tr>
              ))}
              {(!data?.daily_sales || data.daily_sales.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500 font-sans">
                    No sales data available for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
