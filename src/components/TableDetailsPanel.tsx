'use client';

import React, { useState, useEffect } from 'react';
import { CafeTable, TableSession, Order, WaiterCall } from '@/types/database';
import {
  X,
  KeyRound,
  RefreshCw,
  LogOut,
  QrCode,
  Receipt,
  Bell,
  Clock,
  UtensilsCrossed,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  table: CafeTable | null;
  session: TableSession | null;
  orders: Order[];
  waiterCall: WaiterCall | null;
  isOpen: boolean;
  onClose: () => void;
  onGeneratePin: (tableId: string) => Promise<void>;
  onRegeneratePin: (sessionId: string, tableId: string) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
  onResolveWaiterCall: (callId: string) => Promise<void>;
  onOpenBilling: (table: CafeTable, session: TableSession, orders: Order[]) => void;
  onOpenQR: (table: CafeTable) => void;
  onUpdateOrderStatus: (
    orderId: string,
    status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
  ) => Promise<void>;
}

export function TableDetailsPanel({
  table,
  session,
  orders,
  waiterCall,
  isOpen,
  onClose,
  onGeneratePin,
  onRegeneratePin,
  onCloseSession,
  onResolveWaiterCall,
  onOpenBilling,
  onOpenQR,
  onUpdateOrderStatus,
}: Props) {
  const [copiedPin, setCopiedPin] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveDuration, setLiveDuration] = useState<string>('Just now');

  // Live timer tick every 5 seconds
  useEffect(() => {
    function updateTimer() {
      if (!session?.opened_at) {
        setLiveDuration('Just now');
        return;
      }
      const opened = new Date(session.opened_at).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - opened) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);

      if (hours > 0) {
        setLiveDuration(`${hours} hr ${minutes} min`);
      } else if (minutes > 0) {
        setLiveDuration(`${minutes} min`);
      } else {
        setLiveDuration(`${diffSec}s ago`);
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 5000);
    return () => clearInterval(interval);
  }, [session?.opened_at]);

  if (!isOpen || !table) return null;

  const isActive = !!session && session.status === 'ACTIVE';
  const isWaiterCalling = !!waiterCall && waiterCall.status === 'PENDING';

  // Calculate session totals
  const totalItemsCount = orders.reduce(
    (sum, o) =>
      sum +
      (o.order_items?.reduce(
        (s, it) => (it.status !== 'CANCELLED' ? s + it.quantity : s),
        0
      ) || 0),
    0
  );

  const sessionTotalAmount = orders.reduce(
    (sum, o) =>
      sum +
      (o.order_items?.reduce(
        (s, it) =>
          it.status !== 'CANCELLED' ? s + it.price_per_unit * it.quantity : s,
        0
      ) || 0),
    0
  );

  async function handleCopyPin() {
    if (session?.pin_code) {
      await navigator.clipboard.writeText(session.pin_code);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  }

  async function handleAction(fn: () => Promise<void>) {
    setActionLoading(true);
    try {
      await fn();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-950/75 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Slide-over Drawer */}
      <aside className="relative z-10 w-full max-w-md sm:max-w-lg bg-stone-900 border-l border-stone-800 shadow-2xl flex flex-col h-[100dvh] overflow-hidden animate-slide-in-right pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="p-5 border-b border-stone-800 bg-stone-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg ${
                isWaiterCalling
                  ? 'bg-red-500 text-white animate-bounce'
                  : isActive
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                  : 'bg-emerald-500 text-stone-950'
              }`}
            >
              {isWaiterCalling ? '🔔' : '☕'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{table.table_number}</h2>
                <span className="font-mono text-xs font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-700">
                  {table.table_code}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isWaiterCalling ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                    Waiter Calling
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Active Guest Session
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Free / Table Idle
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Waiter Alert Banner if active */}
          {isWaiterCalling && (
            <div className="p-4 bg-red-950/80 border border-red-800 rounded-2xl text-xs space-y-2 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-red-400 animate-bounce" />
                  <span className="font-bold text-red-200">Customer Called for Waiter!</span>
                </div>
                <button
                  onClick={() => handleAction(() => onResolveWaiterCall(waiterCall.id))}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition cursor-pointer"
                >
                  Resolve
                </button>
              </div>
              <p className="text-stone-300 italic">
                Note: &quot;{waiterCall.note || 'Assistance requested at table'}&quot;
              </p>
            </div>
          )}

          {/* Session Overview Box */}
          {isActive ? (
            <div className="bg-gradient-to-br from-amber-950/50 via-stone-900 to-stone-900 border border-amber-900/60 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                    Active 4-Digit Table PIN
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-4xl font-black font-mono text-amber-300 tracking-wider">
                      {session.pin_code || '••••'}
                    </span>
                    <button
                      onClick={handleCopyPin}
                      className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                      title="Copy PIN"
                    >
                      {copiedPin ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => onOpenQR(table)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>QR Stand</span>
                </button>
              </div>

              {/* Session Duration */}
              <div className="flex items-center justify-between pt-3 border-t border-amber-950/60 text-xs">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Session Open Time:</span>
                </span>
                <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-900/40">
                  {liveDuration}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-stone-950/80 border border-dashed border-stone-800 rounded-3xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Table is Free &amp; Ready</h3>
                <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                  When guests arrive at this table, generate a 4-digit PIN for them to start ordering.
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => onOpenQR(table)}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>View QR</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!isActive ? (
              <button
                onClick={() => handleAction(() => onGeneratePin(table.id))}
                disabled={actionLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer touch-manipulation select-none"
              >
                <KeyRound className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>{actionLoading ? 'Generating PIN...' : 'Generate PIN'}</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction(() => onRegeneratePin(session.id, table.id))}
                  disabled={actionLoading}
                  className="py-3 px-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition border border-stone-700 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>Regenerate PIN</span>
                </button>

                <button
                  onClick={() => setConfirmCloseOpen(true)}
                  disabled={actionLoading}
                  className="py-3 px-3 rounded-2xl bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition border border-red-900/50 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Close Session</span>
                </button>

                <button
                  onClick={() => onOpenBilling(table, session, orders)}
                  className="col-span-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Bill &amp; Settle Table (₹{sessionTotalAmount})</span>
                </button>
              </div>
            )}
          </div>

          {/* Confirm Close Session Dialog */}
          {confirmCloseOpen && (
            <div className="p-4 bg-red-950/90 border border-red-700 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-white">Close Table Session?</h4>
                  <p className="text-[11px] text-red-200 mt-0.5">
                    Seated customer phones will immediately show &quot;Session ended. Thank you!&quot; and ordering will be blocked.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setConfirmCloseOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold hover:bg-stone-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmCloseOpen(false);
                    if (session) {
                      handleAction(() => onCloseSession(session.id));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm"
                >
                  Yes, Close Session
                </button>
              </div>
            </div>
          )}

          {/* The Session's Orders Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">
                  Session Orders ({orders.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-stone-400">
                {totalItemsCount} items
              </span>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {orders.map((order, idx) => {
                const orderTotal =
                  order.order_items?.reduce(
                    (sum, it) =>
                      it.status !== 'CANCELLED' ? sum + it.price_per_unit * it.quantity : sum,
                    0
                  ) || 0;

                return (
                  <div
                    key={order.id}
                    className="bg-stone-950/70 border border-stone-800 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800/80">
                      <div>
                        <span className="font-bold text-white">Order #{idx + 1}</span>
                        <span className="text-[10px] text-stone-500 font-mono ml-2">
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Status Stepper Buttons */}
                      <div className="flex items-center gap-1">
                        {(['PENDING', 'PREPARING', 'READY', 'SERVED'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => onUpdateOrderStatus(order.id, st)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                              order.status === st
                                ? 'bg-amber-500 text-stone-950 font-black'
                                : 'bg-stone-800 text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            {st[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-1.5">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-xs">
                          <div>
                            <span className="font-semibold text-stone-200">
                              {item.quantity}x {item.item_name_en}
                            </span>
                            {item.item_notes && (
                              <span className="ml-2 text-[11px] text-amber-400 italic">
                                ({item.item_notes})
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-stone-300">
                            ₹{item.price_per_unit * item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-stone-800/60 text-[11px]">
                      <span className="text-stone-500">Order Subtotal</span>
                      <span className="font-mono font-bold text-amber-400">₹{orderTotal}</span>
                    </div>
                  </div>
                );
              })}

              {orders.length === 0 && (
                <div className="py-8 text-center text-stone-500 bg-stone-950/40 border border-stone-800/60 rounded-2xl">
                  <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-stone-400">No orders placed yet.</p>
                  <p className="text-[10px] text-stone-600 mt-0.5">
                    Guest orders for this session will appear here in real time.
                  </p>
                </div>
              )}
            </div>

            {/* Total Running Session Bill Summary */}
            {orders.length > 0 && (
              <div className="p-3.5 bg-stone-950 border border-stone-800 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-stone-300">Total Running Amount</span>
                <span className="text-lg font-black font-mono text-amber-400">
                  ₹{sessionTotalAmount}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
