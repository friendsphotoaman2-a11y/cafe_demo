'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  ToggleLeft,
  DollarSign,
  Filter,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Clock,
  User,
  X,
} from 'lucide-react';
import { ManagerSettings } from '@/types/database';
import { AuditLogEntry, AuditAction } from '@/lib/audit-logger';
import { apiUrl } from '@/lib/base-path';

interface AuditLogResponse {
  success: boolean;
  logs: AuditLogEntry[];
  summary: {
    total_logs: number;
    pin_generated_count: number;
    order_cancelled_count: number;
    availability_changed_count: number;
    price_changed_count: number;
  };
  google_sheet_id: string;
}

interface Props {
  settings: ManagerSettings;
}

export function AuditLogView({ settings }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditLogResponse['summary']>({
    total_logs: 0,
    pin_generated_count: 0,
    order_cancelled_count: 0,
    availability_changed_count: 0,
    price_changed_count: 0,
  });
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [googleSheetId, setGoogleSheetId] = useState<string>(
    settings.google_sheet_id || '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY'
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/manager/audit-logs?action=${actionFilter}&date=${dateFilter}`)
      );
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
        if (json.summary) setSummary(json.summary);
        if (json.google_sheet_id) setGoogleSheetId(json.google_sheet_id);
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs by search query (title, actor, entity)
  const filteredLogs = logs.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.actor_email.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      JSON.stringify(l.details).toLowerCase().includes(q)
    );
  });

  function getActionBadge(action: AuditAction) {
    switch (action) {
      case 'PIN_GENERATED':
        return {
          label: 'PIN Generated',
          icon: KeyRound,
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'ORDER_CANCELLED':
        return {
          label: 'Order Cancelled',
          icon: AlertTriangle,
          classes: 'bg-red-500/15 text-red-300 border-red-500/30',
        };
      case 'AVAILABILITY_CHANGED':
        return {
          label: 'Availability',
          icon: ToggleLeft,
          classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'PRICE_CHANGED':
        return {
          label: 'Price Changed',
          icon: DollarSign,
          classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          label: action,
          icon: ShieldAlert,
          classes: 'bg-stone-800 text-stone-300 border-stone-700',
        };
    }
  }

  function formatDateTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return iso;
    }
  }

  function formatTimeAgo(iso: string) {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Google Sheet Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Audit Log (Read Only)</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Immutable system activity log: PIN generations, item cancellations, availability toggles, and price changes.
          </p>
        </div>

        <a
          href={`https://docs.google.com/spreadsheets/d/${googleSheetId}`}
          target="_blank"
          rel="noreferrer"
          className="min-h-[40px] py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-95 text-stone-200 hover:text-white font-bold text-xs flex items-center gap-2 border border-stone-800 shadow-md transition self-start sm:self-auto cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Google Sheet AuditLog Tab</span>
          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          onClick={() => setActionFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition active:scale-98 cursor-pointer animate-fade-in-up ${
            actionFilter === 'ALL'
              ? 'bg-amber-500/10 border-amber-500 text-amber-300'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">Total Logs</span>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.total_logs}
          </span>
          <span className="text-[10px] text-stone-500">All recorded events</span>
        </button>

        <button
          onClick={() => setActionFilter('PIN_GENERATED')}
          className={`p-4 rounded-2xl border text-left transition active:scale-98 cursor-pointer animate-fade-in-up ${
            actionFilter === 'PIN_GENERATED'
              ? 'bg-amber-500/10 border-amber-500 text-amber-300'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-400">
              PINs
            </span>
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.pin_generated_count}
          </span>
          <span className="text-[10px] text-stone-500">Session PIN activity</span>
        </button>

        <button
          onClick={() => setActionFilter('ORDER_CANCELLED')}
          className={`p-4 rounded-2xl border text-left transition active:scale-98 cursor-pointer animate-fade-in-up ${
            actionFilter === 'ORDER_CANCELLED'
              ? 'bg-red-500/10 border-red-500 text-red-300'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-red-400">
              Cancelled
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.order_cancelled_count}
          </span>
          <span className="text-[10px] text-stone-500">Order item cancellations</span>
        </button>

        <button
          onClick={() => setActionFilter('AVAILABILITY_CHANGED')}
          className={`p-4 rounded-2xl border text-left transition active:scale-98 cursor-pointer animate-fade-in-up ${
            actionFilter === 'AVAILABILITY_CHANGED'
              ? 'bg-blue-500/10 border-blue-500 text-blue-300'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-blue-400">
              Availability
            </span>
            <ToggleLeft className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.availability_changed_count}
          </span>
          <span className="text-[10px] text-stone-500">Menu toggles &amp; resets</span>
        </button>

        <button
          onClick={() => setActionFilter('PRICE_CHANGED')}
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border text-left transition active:scale-98 cursor-pointer animate-fade-in-up ${
            actionFilter === 'PRICE_CHANGED'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-400">
              Price Edits
            </span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.price_changed_count}
          </span>
          <span className="text-[10px] text-stone-500">Dish rate adjustments</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search audit records (title, reason, table, item, email)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-500"
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

        {/* Responsive Action & Date Selectors */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <Filter className="w-4 h-4 text-stone-500 shrink-0 hidden sm:block" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-stone-300 focus:outline-hidden focus:border-amber-500 cursor-pointer font-semibold"
          >
            <option value="ALL">All Actions</option>
            <option value="PIN_GENERATED">PIN Generation</option>
            <option value="ORDER_CANCELLED">Order Cancellations</option>
            <option value="AVAILABILITY_CHANGED">Availability Changes</option>
            <option value="PRICE_CHANGED">Price Changes</option>
          </select>

          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-base sm:text-xs rounded-xl bg-stone-950 border border-stone-800 text-stone-300 focus:outline-hidden focus:border-amber-500 cursor-pointer font-semibold"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-2.5 text-stone-400 hover:text-amber-400 rounded-xl bg-stone-950 border border-stone-800 hover:bg-stone-800 transition cursor-pointer shrink-0"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Entries List (Newest First) */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-lg">
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 font-mono uppercase tracking-wider">
          <span>Activity Timeline ({filteredLogs.length} events)</span>
          <span>Newest First &bull; Permanent Record</span>
        </div>

        <div className="divide-y divide-stone-800/80">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-16 rounded-2xl animate-shimmer-dark border border-stone-800/60" />
              ))}
            </div>
          ) : (
            filteredLogs.map((item, idx) => {
              const badge = getActionBadge(item.action);
              const BadgeIcon = badge.icon;
              const timeAgo = formatTimeAgo(item.timestamp);

              return (
                <div
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 25, 180)}ms` }}
                  className="p-4 lg:p-5 hover:bg-stone-800/30 transition flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs animate-fade-in-up"
                >
                {/* Left: Action Icon + Title + Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-2xl border shrink-0 ${badge.classes} shadow-xs`}
                  >
                    <BadgeIcon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                      <span className="font-bold text-white text-xs lg:text-sm">
                        {item.title}
                      </span>
                    </div>

                    {/* Metadata line: Actor & Entity */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-stone-500" />
                        <span className="font-mono">{item.actor_email}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono text-stone-500">
                        {item.entity_type}: <strong className="text-stone-300">{item.entity_id}</strong>
                      </span>
                    </div>

                    {/* Formatted details badge/pill */}
                    {item.details && Object.keys(item.details).length > 0 && (
                      <div className="pt-1.5 flex flex-wrap gap-1.5">
                        {Boolean(item.details.reason) && (
                          <span className="px-2 py-0.5 rounded-lg bg-red-950/60 text-red-300 border border-red-900/40 text-[10px]">
                            Reason: <strong>{String(item.details.reason)}</strong>
                          </span>
                        )}
                        {Boolean(item.details.pin_code) && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-900/40 text-[10px] font-mono">
                            PIN: <strong>{String(item.details.pin_code)}</strong>
                          </span>
                        )}
                        {item.details.old_price !== undefined && item.details.new_price !== undefined && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-900/40 text-[10px] font-mono">
                            Price: ₹{String(item.details.old_price)} &rarr; ₹{String(item.details.new_price)}
                          </span>
                        )}
                        {item.details.is_available !== undefined && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-950/60 text-blue-300 border border-blue-900/40 text-[10px]">
                            Status: <strong>{item.details.is_available ? 'Available' : 'Unavailable Today'}</strong>
                          </span>
                        )}
                        {item.details.reset_count !== undefined && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-950/60 text-purple-300 border border-purple-900/40 text-[10px]">
                            Auto-reset: <strong>{String(item.details.reset_count)} items</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Timestamp */}
                <div className="shrink-0 md:text-right font-mono text-[11px] text-stone-400 pl-11 md:pl-0">
                  <div className="flex items-center md:justify-end gap-1 text-white font-medium">
                    <Clock className="w-3 h-3 text-stone-500" />
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>
                  {timeAgo && <span className="text-[10px] text-stone-500 block mt-0.5">{timeAgo}</span>}
                </div>
              </div>
              );
            })
          )}

          {!loading && filteredLogs.length === 0 && (
            <div className="p-12 text-center text-stone-500 space-y-2">
              <ShieldAlert className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
              <p className="text-xs font-semibold text-stone-400">
                No audit records found matching your filters.
              </p>
              <p className="text-[11px] text-stone-500">
                Actions like generating PINs, cancelling items, toggling availability, or editing prices will be logged here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
