'use client';

import React from 'react';
import { Order } from '@/types/database';
import { Clock, CheckCircle2, Flame, UtensilsCrossed } from 'lucide-react';

interface Props {
  orders: Order[];
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
}

export function LiveOrderList({ orders, deviceId, isOpen, onClose, tableNumber }: Props) {
  if (!isOpen) return null;

  // Split into "Your order" (matching deviceId) and "Others at your table"
  const myOrders = orders.filter(o => o.device_id === deviceId);
  const otherOrders = orders.filter(o => o.device_id !== deviceId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 animate-spin" /> Received
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <Flame className="w-3 h-3 text-orange-600" /> Preparing
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <UtensilsCrossed className="w-3 h-3" /> Ready
          </span>
        );
      case 'SERVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Served
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  const calculateTotal = (orderList: Order[]) => {
    return orderList.reduce((acc, order) => {
      const itemsSum =
        order.order_items?.reduce(
          (sum, it) => (it.status !== 'CANCELLED' ? sum + it.price_per_unit * it.quantity : sum),
          0
        ) || 0;
      return acc + itemsSum;
    }, 0);
  };

  const totalTableAmount = calculateTotal(orders);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Table Activity</h3>
            <p className="text-xs text-amber-100">{tableNumber} • Shared Live View</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No orders placed yet for this table.</p>
              <p className="text-xs text-gray-400 mt-1">Browse the menu to place your first round!</p>
            </div>
          ) : (
            <>
              {/* "Your order" (Highlighted section) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h4 className="font-bold text-sm text-gray-900">Your Order</h4>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    This Phone
                  </span>
                </div>

                {myOrders.length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200">
                    You haven&apos;t ordered any items from this phone yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myOrders.map(order => (
                      <div
                        key={order.id}
                        className="p-3 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/20 shadow-xs"
                      >
                        <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-100">
                          <span className="text-[11px] text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="space-y-1.5">
                          {order.order_items?.map(item => (
                            <div key={item.id} className="flex justify-between items-start text-sm">
                              <div>
                                <span className="font-medium text-gray-800">
                                  {item.quantity}x {item.item_name_en}
                                </span>
                                {item.item_notes && (
                                  <p className="text-xs text-amber-700 italic">
                                    Note: {item.item_notes}
                                  </p>
                                )}
                              </div>
                              <span className="font-semibold text-gray-900">
                                ₹{item.price_per_unit * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* "Others at your table" */}
              {otherOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h4 className="font-bold text-sm text-gray-800">Others at your table</h4>
                    </div>
                    <span className="text-xs text-gray-500">
                      {otherOrders.length} order{otherOrders.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {otherOrders.map(order => (
                      <div
                        key={order.id}
                        className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 shadow-2xs"
                      >
                        <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-100">
                          <span className="text-[11px] text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="space-y-1.5">
                          {order.order_items?.map(item => (
                            <div key={item.id} className="flex justify-between items-start text-sm">
                              <div>
                                <span className="text-gray-700">
                                  {item.quantity}x {item.item_name_en}
                                </span>
                                {item.item_notes && (
                                  <p className="text-xs text-gray-500 italic">
                                    Note: {item.item_notes}
                                  </p>
                                )}
                              </div>
                              <span className="text-gray-700 font-medium">
                                ₹{item.price_per_unit * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Counter billing notice */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-semibold text-gray-900">
            <span>Table Running Total:</span>
            <span className="text-base text-amber-700 font-bold">₹{totalTableAmount}</span>
          </div>
          <div className="bg-amber-50 rounded-xl p-2.5 text-center text-xs text-amber-900 font-medium border border-amber-200">
            ℹ️ Billing is done only at the counter. When you are ready, please visit the counter to settle your bill.
          </div>
        </div>
      </div>
    </div>
  );
}
