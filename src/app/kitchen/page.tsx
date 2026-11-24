'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order, CafeTable, ManagerSettings } from '@/types/database';
import { playWaiterCallChime, unlockAudio } from '@/lib/audio-chime';
import { apiUrl } from '@/lib/base-path';
import {
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  AlertCircle,
  Sliders,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function KitchenPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, CafeTable>>({});
  const [settings, setSettings] = useState<ManagerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // 1. Verify Manager Authentication
  useEffect(() => {
    async function checkAuth() {
      if (typeof window === 'undefined') return;
      const devCookie = document.cookie.includes('cafe_manager_dev_mode=true');
      if (devCookie) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/manager/login?redirect=/kitchen');
        return;
      }

      // Check manager allowlist
      try {
        const res = await fetch(apiUrl('/api/manager/auth/check'));
        const data = await res.json();
        if (!data.allowed) {
          await supabase.auth.signOut();
          router.replace('/manager/login?error=not_allowed');
        }
      } catch {
        // Network fallback
      }
    }
    checkAuth();
  }, [router]);

  // 2. Live IST Digital Clock
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Track Fullscreen State
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // 4. Sound Unlock
  async function handleUnlockSound() {
    const ok = await unlockAudio();
    if (ok) setSoundUnlocked(true);
  }

  // 5. Fetch Kitchen Data
  const fetchKitchenData = useCallback(async () => {
    const supabase = createClient();

    // Settings check via API to get extended settings
    try {
      const setRes = await fetch(apiUrl('/api/manager/settings'));
      const setData = await setRes.json();
      if (setData.success && setData.settings) {
        setSettings(setData.settings);
      } else {
        const { data: setRow } = await supabase
          .from('manager_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (setRow) setSettings(setRow as ManagerSettings);
      }
    } catch {
      const { data: setRow } = await supabase
        .from('manager_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (setRow) setSettings(setRow as ManagerSettings);
    }

    // Tables lookup
    const { data: tblData } = await supabase.from('cafe_tables').select('*');
    if (tblData) {
      const map: Record<string, CafeTable> = {};
      tblData.forEach(t => {
        map[t.id] = t;
      });
      setTables(map);
    }

    // Active kitchen orders (PENDING, PREPARING, READY)
    try {
      const ordRes = await fetch(apiUrl('/api/manager/orders'));
      const ordJson = await ordRes.json();
      if (ordJson.success && ordJson.orders) {
        const activeKitchenOrders = ordJson.orders.filter(
          (o: Order) =>
            ['PENDING', 'PREPARING', 'READY'].includes(o.status) &&
            (o.order_items || []).some(it => it.status !== 'CANCELLED')
        );
        setOrders(prev => {
          if (prev.length > 0 && activeKitchenOrders.length > prev.length) {
            playWaiterCallChime();
          }
          return activeKitchenOrders;
        });
      } else {
        const { data: ordData } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('status', ['PENDING', 'PREPARING', 'READY'])
          .order('created_at', { ascending: true });
        if (ordData) setOrders(ordData as Order[]);
      }
    } catch {
      const { data: ordData } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['PENDING', 'PREPARING', 'READY'])
        .order('created_at', { ascending: true });
      if (ordData) setOrders(ordData as Order[]);
    }
    setLoading(false);
  }, []);

  // 6. Realtime Subscriptions
  useEffect(() => {
    fetchKitchenData();

    // Guaranteed background polling every 2 seconds for on-the-spot KDS ticket display
    const pollInterval = setInterval(() => {
      fetchKitchenData();
    }, 2000);

    const supabase = createClient();
    const channel = supabase
      .channel('kitchen_kds_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          fetchKitchenData();
          playWaiterCallChime();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          fetchKitchenData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchKitchenData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manager_settings' },
        () => {
          fetchKitchenData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchKitchenData]);

  // 7. Update Status (Preparing, Ready, Served)
  async function handleAdvanceStatus(
    orderId: string,
    nextStatus: 'PREPARING' | 'READY' | 'SERVED'
  ) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(apiUrl('/api/manager/orders/update-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev =>
          prev
            .map(o => (o.id === orderId ? { ...o, status: nextStatus } : o))
            .filter(o => o.status !== 'SERVED')
        );
      } else {
        alert(data.message || 'Failed to update kitchen ticket');
      }
    } catch {
      alert('Network error updating ticket');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // When Kitchen is OFF:
  // "When Kitchen is OFF, /kitchen shows "Kitchen screen is disabled" and orders appear only in the manager dashboard."
  // ---------------------------------------------------------------------------
  if (!loading && settings && !settings.kitchen_screen_enabled) {
    return (
      <div className="min-h-[100dvh] bg-stone-950 text-white flex flex-col items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center mb-6 shadow-2xl animate-scale-up">
          <ChefHat className="w-10 h-10 text-stone-500" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black mb-3 text-white tracking-tight">
          Kitchen screen is disabled
        </h1>

        <p className="text-sm text-stone-400 max-w-md mb-8 leading-relaxed">
          Kitchen screen is disabled. Orders appear only in the manager dashboard.
          You can re-enable it anytime from the Manager Settings tab.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/manager?tab=settings"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 font-bold text-xs rounded-2xl transition shadow-lg shadow-amber-600/20 active:scale-95 touch-manipulation"
          >
            <Sliders className="w-4 h-4" />
            <span>Enable in Manager Settings</span>
          </Link>
          <Link
            href="/manager?tab=orders"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 hover:bg-stone-800 border border-stone-800 font-bold text-xs rounded-2xl transition text-stone-300 active:scale-95 touch-manipulation"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>View Manager Orders</span>
          </Link>
        </div>
      </div>
    );
  }

  // Active Ticket Queues
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY');

  return (
    <div className="min-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col font-sans select-none pb-[env(safe-area-inset-bottom)] animate-fade-in">
      {/* ======================================================== */}
      {/* 1. KDS TOP HEADER BAR                                    */}
      {/* ======================================================== */}
      <header className="bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-3 sm:px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/manager"
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition shrink-0 active:scale-95 touch-manipulation"
            title="Return to Manager Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  {settings?.cafe_name || 'Cafe'} — Kitchen
                </h1>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Live KDS
                </span>
              </div>
              <span className="md:hidden text-[10px] text-amber-400 font-bold block">
                {orders.length} Active {orders.length === 1 ? 'Ticket' : 'Tickets'} {currentTime ? `• ${currentTime}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Clock & Active Badge */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="px-3 py-1 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs text-amber-300 font-bold tracking-widest flex items-center gap-1.5 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentTime || 'IST TIME'}</span>
          </div>
          <span className="text-xs px-3 py-1 rounded-xl bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
            {orders.length} Active {orders.length === 1 ? 'Ticket' : 'Tickets'}
          </span>
        </div>

        {/* Right Tools: Sound, Fullscreen, Refresh */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!soundUnlocked ? (
            <button
              onClick={handleUnlockSound}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 animate-pulse transition cursor-pointer active:scale-95 touch-manipulation"
              title="Tap once to enable audio bell chime for incoming orders"
            >
              <VolumeX className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Sound OFF</span>
            </button>
          ) : (
            <button
              onClick={() => playWaiterCallChime()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition cursor-pointer active:scale-95 touch-manipulation"
              title="Audio active - click to test chime"
            >
              <Volume2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sound ON</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (KDS TV mode)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={fetchKitchenData}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer active:scale-95 touch-manipulation"
            title="Refresh active tickets"
          >
            <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. THREE COLUMN LIVE KITCHEN BOARD                       */}
      {/* ======================================================== */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* ------------------------------------------------------ */}
        {/* COLUMN 1: NEW / PENDING ORDERS (Waiting to Cook)       */}
        {/* ------------------------------------------------------ */}
        <div className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl p-3.5 sm:p-4 min-h-[240px] md:min-h-[500px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-red-400">
                New Tickets ({pendingOrders.length})
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 1
            </span>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
            {pendingOrders.map(order => {
              const table = tables[order.table_id];
              const minutesAgo = Math.floor(
                (Date.now() - new Date(order.created_at).getTime()) / 60000
              );
              const orderPrefix = (settings?.order_id_prefix || 'ORD-').trim();
              const formattedId = `${orderPrefix}${order.id.slice(0, 6).toUpperCase()}`;

              return (
                <div
                  key={order.id}
                  className="bg-stone-900 border-2 border-red-500/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all hover:border-red-500 animate-fade-in-up"
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="flex justify-between items-start pb-2.5 border-b border-stone-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white tracking-tight">
                            {table ? table.table_number : 'Table'}
                          </span>
                          <span className="text-xs font-mono font-bold text-red-400 bg-red-950/70 px-2 py-0.5 rounded-lg border border-red-800/40">
                            {formattedId}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                          minutesAgo > 15
                            ? 'text-red-300 bg-red-950 border border-red-700 animate-pulse'
                            : minutesAgo > 5
                            ? 'text-orange-400 bg-orange-950/70 border border-orange-800/40'
                            : 'text-stone-300 bg-stone-800'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {minutesAgo}m ago
                      </span>
                    </div>

                    {/* Ticket Items */}
                    <div className="py-3.5 space-y-2.5">
                      {order.order_items?.map(it => (
                        <div key={it.id} className="text-sm">
                          <div className="flex items-start justify-between font-bold text-stone-100">
                            <span className="text-base text-white">
                              <strong className="text-amber-400 font-black text-lg mr-1.5">
                                {it.quantity}x
                              </strong>
                              {it.item_name_en}
                            </span>
                            <span className="text-xs text-stone-400 font-normal ml-2 shrink-0">
                              {it.item_name_hi}
                            </span>
                          </div>
                          {it.item_notes && (
                            <p className="text-xs text-amber-300 font-semibold bg-amber-950/50 px-2.5 py-1.5 rounded-lg mt-1 border border-amber-900/60 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Note: {it.item_notes}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button: PREPARING */}
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'PREPARING')}
                    disabled={updatingOrderId === order.id}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Preparing (Start Cooking)</span>
                  </button>
                </div>
              );
            })}

            {pendingOrders.length === 0 && (
              <div className="text-center py-10 md:py-16 px-4">
                <ChefHat className="w-10 h-10 text-stone-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-stone-500 font-medium">
                  No new pending tickets.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ */}
        {/* COLUMN 2: PREPARING / COOKING IN PROGRESS              */}
        {/* ------------------------------------------------------ */}
        <div className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl p-3.5 sm:p-4 min-h-[240px] md:min-h-[500px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-orange-400">
                Cooking ({preparingOrders.length})
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 2
            </span>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
            {preparingOrders.map(order => {
              const table = tables[order.table_id];
              const minutesAgo = Math.floor(
                (Date.now() - new Date(order.created_at).getTime()) / 60000
              );
              const orderPrefix = (settings?.order_id_prefix || 'ORD-').trim();
              const formattedId = `${orderPrefix}${order.id.slice(0, 6).toUpperCase()}`;

              return (
                <div
                  key={order.id}
                  className="bg-stone-900 border-2 border-orange-500/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all hover:border-orange-500 animate-fade-in-up"
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="flex justify-between items-start pb-2.5 border-b border-stone-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white tracking-tight">
                            {table ? table.table_number : 'Table'}
                          </span>
                          <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/70 px-2 py-0.5 rounded-lg border border-orange-800/40">
                            {formattedId}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                          minutesAgo > 15
                            ? 'text-red-300 bg-red-950 border border-red-700 animate-pulse'
                            : 'text-orange-400 bg-orange-950/70 border border-orange-800/40'
                        }`}
                      >
                        <Flame className="w-3 h-3 text-orange-500" />
                        {minutesAgo}m on stove
                      </span>
                    </div>

                    {/* Ticket Items */}
                    <div className="py-3.5 space-y-2.5">
                      {order.order_items?.map(it => (
                        <div key={it.id} className="text-sm">
                          <div className="flex items-start justify-between font-bold text-stone-100">
                            <span className="text-base text-white">
                              <strong className="text-orange-400 font-black text-lg mr-1.5">
                                {it.quantity}x
                              </strong>
                              {it.item_name_en}
                            </span>
                            <span className="text-xs text-stone-400 font-normal ml-2 shrink-0">
                              {it.item_name_hi}
                            </span>
                          </div>
                          {it.item_notes && (
                            <p className="text-xs text-amber-300 font-semibold bg-amber-950/50 px-2.5 py-1.5 rounded-lg mt-1 border border-amber-900/60 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Note: {it.item_notes}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button: READY */}
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'READY')}
                    disabled={updatingOrderId === order.id}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ready (Food Plated)</span>
                  </button>
                </div>
              );
            })}

            {preparingOrders.length === 0 && (
              <div className="text-center py-10 md:py-16 px-4">
                <Flame className="w-10 h-10 text-stone-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-stone-500 font-medium">
                  No orders cooking right now.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ */}
        {/* COLUMN 3: READY TO SERVE (Waiting for Waitstaff)       */}
        {/* ------------------------------------------------------ */}
        <div className="flex flex-col bg-stone-900/60 border border-stone-800 rounded-3xl p-3.5 sm:p-4 min-h-[240px] md:min-h-[500px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-blue-400">
                Ready to Serve ({readyOrders.length})
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 3
            </span>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
            {readyOrders.map(order => {
              const table = tables[order.table_id];
              const orderPrefix = (settings?.order_id_prefix || 'ORD-').trim();
              const formattedId = `${orderPrefix}${order.id.slice(0, 6).toUpperCase()}`;

              return (
                <div
                  key={order.id}
                  className="bg-stone-900 border-2 border-blue-500/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all hover:border-blue-500 animate-fade-in-up"
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="flex justify-between items-start pb-2.5 border-b border-stone-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white tracking-tight">
                            {table ? table.table_number : 'Table'}
                          </span>
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/70 px-2 py-0.5 rounded-lg border border-blue-800/40">
                            {formattedId}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-800/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                      </span>
                    </div>

                    {/* Ticket Items */}
                    <div className="py-3.5 space-y-2">
                      {order.order_items?.map(it => (
                        <div key={it.id} className="text-xs text-stone-300">
                          <span className="font-bold text-stone-100">
                            <strong className="text-blue-400 mr-1.5">{it.quantity}x</strong>
                            {it.item_name_en}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button: SERVED */}
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'SERVED')}
                    disabled={updatingOrderId === order.id}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Served</span>
                  </button>
                </div>
              );
            })}

            {readyOrders.length === 0 && (
              <div className="text-center py-10 md:py-16 px-4">
                <CheckCircle2 className="w-10 h-10 text-stone-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-stone-500 font-medium">
                  No orders waiting to be served.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
