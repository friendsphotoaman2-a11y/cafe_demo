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
  Award,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiUrl } from '@/lib/base-path';
import { Bill, OrderItem } from '@/types/database';
import { parseSheetDate } from '@/lib/date-utils';

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
  onReprintInvoice: (bill: Bill, items?: OrderItem[]) => void;
}

export function OrderHistoryView({ onReprintInvoice }: Props) {
  const [orders, setOrders] = useState<OrderHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sheetConnected, setSheetConnected] = useState<boolean>(true);

  // Filters & Pagination
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [cacheAgeSec, setCacheAgeSec] = useState<number | null>(null);

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<{
    mode: 'single' | 'all';
    orderId?: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOrderHistory = useCallback(
    async (isRefresh = false, silent = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!silent) setLoading(true);
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
          setSheetConnected(data.sheetConnected !== false);
          if (data.cacheAgeSec !== undefined) setCacheAgeSec(data.cacheAgeSec);
        } else {
          setSheetConnected(false);
          setOrders([]);
          setTotalCount(0);
          setErrorMsg(data.message || 'Failed to load order history from Google Sheets.');
        }
      } catch {
        setErrorMsg('Network error loading order history.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, dateRange, tableFilter, searchQuery]
  );

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  // Realtime sync every 15s when visible + instant sync on tab focus
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fetchOrderHistory(true, true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOrderHistory(true, true);
      }
    }, 15000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(interval);
    };
  }, [fetchOrderHistory]);

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setErrorMsg(null);

    try {
      const payload =
        confirmDelete.mode === 'all'
          ? { clearAll: true }
          : { orderId: confirmDelete.orderId };

      const res = await fetch(apiUrl('/api/manager/order-history'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Failed to delete order from Google Sheet.');
      } else {
        setConfirmDelete(null);
        await fetchOrderHistory(true, true);
      }
    } catch {
      setErrorMsg('Network error while deleting order.');
    } finally {
      setDeleting(false);
    }
  }

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

  async function handleReprint(o: OrderHistoryRecord) {
    const billObj: Bill = {
      id: `sheet-bill-${o.order_id}`,
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
      created_at:
        parseSheetDate(o.completed_at)?.toISOString() ||
        parseSheetDate(`${o.date} ${o.time}`)?.toISOString() ||
        new Date().toISOString(),
    };

    try {
      const res = await fetch(apiUrl(`/api/manager/invoices/search?q=${encodeURIComponent(o.order_id)}`));
      const data = await res.json();
      if (data.success && data.found && data.bill) {
        onReprintInvoice(data.bill, data.items || []);
        return;
      }
    } catch {
      // fallback to basic bill object
    }
    onReprintInvoice(billObj, []);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with Title, Refresh, Clear All, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight">Order History &amp; Archives</h2>
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
            Synced live with your Google Sheet Orders tab — deletions &amp; new bills reflect automatically.
            {cacheAgeSec !== null && (
              <span className="ml-1 text-stone-500 font-mono">(Synced {cacheAgeSec}s ago)</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchOrderHistory(true)}
            disabled={refreshing || loading}
            className="min-h-[40px] py-2 px-3.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-white active:scale-95 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Sheet</span>
          </button>

          {totalCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmDelete({
                  mode: 'all',
                  label: `Delete ALL ${totalCount} orders from Google Sheets?`,
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
            disabled={orders.length === 0}
            className="min-h-[40px] py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Order ID, Phone, or Customer..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-9 py-2 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-500 hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 overflow-x-auto scrollbar-none max-w-full">
            {(['all', 'today', '7days', '30days'] as const).map(range => (
              <button
                key={range}
                type="button"
                onClick={() => {
                  setDateRange(range);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg whitespace-nowrap transition cursor-pointer ${
                  dateRange === range
                    ? 'bg-amber-500 text-stone-950 shadow-xs font-black'
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

          <input
            type="text"
            placeholder="Table #"
            value={tableFilter}
            onChange={e => {
              setTableFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-28 py-2 px-3 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 animate-shake">
          {errorMsg}
        </div>
      )}

      {/* Customer Insights Banner (When searching by phone/customer) */}
      {searchQuery.trim() && orders.length > 0 && (
        <div className="p-4 rounded-3xl bg-linear-to-r from-stone-900 via-stone-900 to-amber-950/40 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-fade-in-up">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-amber-500 to-amber-600 text-stone-950 flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 shrink-0">
              {orders[0].customer_name ? orders[0].customer_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-white">{orders[0].customer_name || 'Guest'}</span>
                <span className="text-xs font-mono text-stone-400 bg-stone-950 px-2 py-0.5 rounded-md border border-stone-800">
                  {orders[0].phone || searchQuery}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Loyalty Customer •{' '}
                  {Math.max(...orders.map(o => o.visit_no || 1), orders.length) >= 5
                    ? 'Loyalty Free Coffee Eligible'
                    : `Visit ${Math.max(...orders.map(o => o.visit_no || 1), orders.length) % 5}/5 towards Free Coffee`}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
            <div className="bg-stone-950/90 px-4 py-2 rounded-xl border border-stone-800 text-center">
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Total Visits</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {Math.max(...orders.map(o => o.visit_no || 1), orders.length)} Visits
              </span>
            </div>
            <div className="bg-stone-950/90 px-4 py-2 rounded-xl border border-stone-800 text-center">
              <span className="text-[10px] text-stone-400 uppercase font-bold block">Total Spent</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                ₹{orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(1)}
              </span>
            </div>
            {orders.filter(o => o.free_visit === 'YES').length > 0 && (
              <div className="col-span-2 sm:col-span-1 bg-emerald-950/60 px-4 py-2 rounded-xl border border-emerald-500/30 text-center">
                <span className="text-[10px] text-emerald-300 uppercase font-bold block">Free Coffees</span>
                <span className="text-base font-black text-emerald-300 font-mono">
                  {orders.filter(o => o.free_visit === 'YES').length} ☕
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders List / Table Container */}
      <div className="rounded-3xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-16 rounded-2xl animate-shimmer-dark border border-stone-800/60" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 px-6 text-center text-stone-500">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2.5 opacity-30" />
            <p className="font-bold text-sm text-stone-300">No orders in Google Sheet.</p>
            <p className="text-xs text-stone-500 mt-1">
              When bills are settled, they appear here in real time from Google Sheets.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Card View */}
            <div className="lg:hidden divide-y divide-stone-800/80">
              {orders.map((ord, idx) => (
                <div
                  key={ord.order_id || idx}
                  style={{ animationDelay: `${Math.min(idx * 35, 200)}ms` }}
                  className="p-4 space-y-3 animate-fade-in-up"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-sm text-amber-300">{ord.order_id}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {ord.date} {ord.time} • <strong className="text-stone-300">{ord.table}</strong>
                      </p>
                    </div>
                    <span className="font-mono font-black text-base text-white shrink-0">₹{ord.total}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/70 rounded-xl p-2.5 border border-stone-800/70 text-xs">
                    <div>
                      <span className="font-bold text-white block">{ord.customer_name || 'Guest'}</span>
                      <span className="font-mono text-[11px] text-stone-400">{ord.phone || 'N/A'}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-black font-mono">
                      <span>Visit #{ord.visit_no || 1}</span>
                      {ord.free_visit === 'YES' && <span className="text-emerald-400 ml-0.5">☕ FREE</span>}
                    </span>
                  </div>

                  {ord.items && <p className="text-xs text-stone-300 line-clamp-2">{ord.items}</p>}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-mono text-stone-500">
                      Sub: ₹{ord.subtotal} • GST: ₹{ord.tax}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleReprint(ord)}
                        className="min-h-[38px] py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-300 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Reprint</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            mode: 'single',
                            orderId: ord.order_id,
                            label: `Delete order ${ord.order_id} (${ord.customer_name}) from Google Sheets?`,
                          })
                        }
                        className="min-h-[38px] py-1.5 px-2.5 rounded-xl bg-red-950/70 hover:bg-red-900/80 active:scale-95 text-red-300 border border-red-800/60 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Delete from Google Sheets"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Full Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-[11px] text-stone-400 uppercase font-bold bg-stone-900/90">
                    <th className="py-3 px-3.5 font-mono">Order ID</th>
                    <th className="py-3 px-3">Date &amp; Time</th>
                    <th className="py-3 px-3">Table</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Visit #</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Subtotal</th>
                    <th className="py-3 px-3">GST</th>
                    <th className="py-3 px-3">Total</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/50 font-mono">
                  {orders.map((ord, idx) => (
                    <tr key={ord.order_id || idx} className="hover:bg-stone-900/80 transition">
                      <td className="py-3 px-3.5 font-bold text-amber-300">{ord.order_id}</td>
                      <td className="py-3 px-3 text-stone-300 whitespace-nowrap font-sans text-xs">
                        {ord.date} {ord.time}
                      </td>
                      <td className="py-3 px-3 text-stone-300 font-sans">{ord.table}</td>
                      <td className="py-3 px-3 text-white font-sans font-medium">{ord.customer_name || 'Guest'}</td>
                      <td className="py-3 px-3 text-stone-400">{ord.phone || 'N/A'}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black font-mono">
                          <span>Visit #{ord.visit_no || 1}</span>
                          {ord.free_visit === 'YES' && (
                            <span className="text-[10px] text-emerald-400 font-extrabold ml-1">☕ FREE</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-300 font-sans max-w-[180px] truncate" title={ord.items}>
                        {ord.items || 'Items recorded'}
                      </td>
                      <td className="py-3 px-3 text-stone-400">₹{ord.subtotal}</td>
                      <td className="py-3 px-3 text-stone-400">₹{ord.tax}</td>
                      <td className="py-3 px-3 font-black text-white whitespace-nowrap">₹{ord.total}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReprint(ord)}
                            className="py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Reprint Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Reprint</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                mode: 'single',
                                orderId: ord.order_id,
                                label: `Delete order ${ord.order_id} (${ord.customer_name}) permanently from Google Sheets?`,
                              })
                            }
                            className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition cursor-pointer"
                            title="Delete from Google Sheet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 bg-stone-950/40">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} orders
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-stone-900 border border-stone-800 disabled:opacity-40 text-stone-300 hover:text-white cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 font-mono text-[11px]">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-stone-900 border border-stone-800 disabled:opacity-40 text-stone-300 hover:text-white cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
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
                <h3 className="font-bold text-base text-white">Delete from Google Sheet</h3>
                <p className="text-xs text-stone-400">
                  This removes the row(s) directly from your Google Sheet (Orders &amp; OrderItems).
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
