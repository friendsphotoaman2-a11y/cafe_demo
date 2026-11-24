'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Receipt,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { apiUrl } from '@/lib/base-path';
import { Bill } from '@/types/database';

interface OrderHistoryRecord {
  order_id: string;
  date: string;
  time: string;
  table: string;
  customer_name: string;
  phone: string;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_mode: string;
  status: string;
  completed_at: string;
  visit_no: number;
  free_visit: string;
}

interface Props {
  onReprintInvoice: (bill: Bill) => void;
}

export function OrderHistoryView({ onReprintInvoice }: Props) {
  const [orders, setOrders] = useState<OrderHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [cacheAgeSec, setCacheAgeSec] = useState<number | null>(null);

  const fetchOrderHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        dateRange,
      });

      if (isRefresh) params.set('refresh', 'true');
      if (tableFilter) params.set('table', tableFilter);
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        if (/^\d+$/.test(q)) {
          params.set('phone', q);
        } else {
          params.set('orderId', q);
        }
      }

      const res = await fetch(apiUrl(`/api/manager/order-history?${params.toString()}`));
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        if (data.cacheAgeSec !== undefined) setCacheAgeSec(data.cacheAgeSec);
      } else {
        setErrorMsg(data.message || 'Failed to load order history from Google Sheets.');
      }
    } catch {
      setErrorMsg('Network error loading order history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, dateRange, tableFilter, searchQuery]);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  // Export CSV
  function handleExportCSV() {
    if (orders.length === 0) return;

    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Table',
      'Customer Name',
      'Phone',
      'Items Ordered',
      'Subtotal',
      'Tax',
      'Total Amount',
      'Payment Mode',
      'Status',
      'Visit No',
      'Loyalty Free',
    ];

    const csvRows = orders.map(o => [
      `"${o.order_id}"`,
      `"${o.date}"`,
      `"${o.time}"`,
      `"${o.table}"`,
      `"${o.customer_name.replace(/"/g, '""')}"`,
      `"${o.phone}"`,
      `"${o.items.replace(/"/g, '""')}"`,
      o.subtotal,
      o.tax,
      o.total,
      `"${o.payment_mode}"`,
      `"${o.status}"`,
      o.visit_no,
      `"${o.free_visit}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Order_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleReprint(o: OrderHistoryRecord) {
    const billObj: Bill = {
      id: `bill-${o.order_id}`,
      invoice_number: o.order_id,
      session_id: '00000000-0000-0000-0000-000000000000',
      table_id: '00000000-0000-0000-0000-000000000000',
      table_number: o.table,
      customer_name: o.customer_name,
      customer_phone: o.phone,
      subtotal: o.subtotal,
      discount: 0,
      gst_rate: 5.0,
      gst_amount: o.tax,
      total_amount: o.total,
      visit_count: o.visit_no,
      is_loyalty_free_coffee: o.free_visit === 'YES',
      synced_to_sheets: true,
      created_at: o.completed_at || `${o.date} ${o.time}`,
    };
    onReprintInvoice(billObj);
  }

  return (
    <div className="space-y-4">
      {/* Header with Title, Refresh, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight">Order History &amp; Archives</h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-500/30 text-[10px] font-bold font-mono">
              Google Sheets Synced
            </span>
          </div>
          <p className="text-xs text-stone-400">
            Completed counter orders with date filters, pagination, thermal reprint, and CSV export.
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
            onClick={() => fetchOrderHistory(true)}
            disabled={refreshing || loading}
            className="py-2 px-3 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={orders.length === 0}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Order ID or Phone..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
          {(['all', 'today', '7days', '30days'] as const).map(range => (
            <button
              key={range}
              type="button"
              onClick={() => {
                setDateRange(range);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                dateRange === range
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {range === 'all'
                ? 'All Time'
                : range === 'today'
                ? 'Today'
                : range === '7days'
                ? 'Last 7 Days'
                : 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Table Filter */}
        <input
          type="text"
          placeholder="Table # (e.g. 1)"
          value={tableFilter}
          onChange={e => {
            setTableFilter(e.target.value);
            setPage(1);
          }}
          className="w-28 py-1.5 px-3 text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
        />
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-800 text-[11px] text-stone-400 uppercase font-bold bg-stone-900/90">
                <th className="py-2.5 px-3.5 font-mono">Order ID</th>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Table</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Subtotal</th>
                <th className="py-2.5 px-3">GST</th>
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3.5 text-right">Reprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-500 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading orders from Google Sheets...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-500 font-sans">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-stone-400">No completed orders found.</p>
                    <p className="text-xs text-stone-600 mt-1">Orders sync to Google Sheets when bills are settled.</p>
                  </td>
                </tr>
              ) : (
                orders.map((ord, idx) => (
                  <tr key={ord.order_id || idx} className="hover:bg-stone-900/80 transition">
                    <td className="py-2.5 px-3.5 font-bold text-amber-300">
                      {ord.order_id}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 whitespace-nowrap font-sans text-xs">
                      {ord.date} {ord.time}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 font-sans">
                      {ord.table}
                    </td>
                    <td className="py-2.5 px-3 text-white font-sans font-medium">
                      {ord.customer_name || 'Guest'}
                    </td>
                    <td className="py-2.5 px-3 text-stone-400">
                      {ord.phone || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-stone-300 font-sans max-w-[180px] truncate" title={ord.items}>
                      {ord.items || 'Items recorded'}
                    </td>
                    <td className="py-2.5 px-3 text-stone-400">
                      ₹{ord.subtotal}
                    </td>
                    <td className="py-2.5 px-3 text-stone-400">
                      ₹{ord.tax}
                    </td>
                    <td className="py-2.5 px-3 font-black text-white whitespace-nowrap">
                      ₹{ord.total}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-sans">
                      <button
                        type="button"
                        onClick={() => handleReprint(ord)}
                        className="py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Reprint Invoice"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Reprint</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 bg-stone-950/40">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} orders
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 disabled:opacity-40 text-stone-300 hover:text-white cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 font-mono text-[11px]">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 disabled:opacity-40 text-stone-300 hover:text-white cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
