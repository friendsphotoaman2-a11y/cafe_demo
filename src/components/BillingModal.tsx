'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CafeTable, TableSession, Order, OrderItem, Bill, ManagerSettings } from '@/types/database';
import {
  Receipt,
  CheckCircle2,
  Coffee,
  Printer,
  Download,
  Loader2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  Sparkles,
  Gift,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { apiUrl } from '@/lib/base-path';

interface Props {
  table: CafeTable;
  session: TableSession;
  orders: Order[];
  settings: ManagerSettings;
  isOpen: boolean;
  onClose: () => void;
  onBillCompleted: () => void;
}

interface LoyaltyLookupResult {
  found: boolean;
  phone: string;
  name?: string;
  previous_visits: number;
  new_count: number;
  is_free_visit: boolean;
  loyalty_n: number;
  stamps_earned: number;
  stamps_total: number;
}

function isCoffeeItem(name: string): boolean {
  const keywords = [
    'coffee',
    'cappuccino',
    'espresso',
    'latte',
    'cold coffee',
    'brew',
    'mocha',
    'americano',
    'macchiato',
    'frappe',
  ];
  const lower = name.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function BillingModal({
  table,
  session,
  orders,
  settings,
  isOpen,
  onClose,
  onBillCompleted,
}: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'UPI' | 'card'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpLoyalty, setLookingUpLoyalty] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyLookupResult | null>(null);
  const [selectedFreeCoffeeId, setSelectedFreeCoffeeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [completedItems, setCompletedItems] = useState<OrderItem[]>([]);
  const [sheetsSynced, setSheetsSynced] = useState<boolean>(false);

  // Compute non-cancelled items
  const allItems: OrderItem[] = useMemo(() => {
    const list: OrderItem[] = [];
    for (const o of orders) {
      if (o.order_items) {
        list.push(...o.order_items.filter(it => it.status !== 'CANCELLED'));
      }
    }
    return list;
  }, [orders]);

  // Coffee items available in this session
  const coffeeItems = useMemo(() => {
    return allItems.filter(it => isCoffeeItem(it.item_name_en));
  }, [allItems]);

  const cleanCustomerPhone = useMemo(
    () => normalizePhoneNumber(customerPhone),
    [customerPhone]
  );
  const lastLookedUpPhoneRef = useRef<string>('');

  // Lookup customer in Google Sheet Customers tab ONLY when the 10-digit phone changes
  useEffect(() => {
    if (!isOpen) return;

    if (cleanCustomerPhone.length !== 10) {
      lastLookedUpPhoneRef.current = '';
      setLoyaltyData(null);
      setSelectedFreeCoffeeId(null);
      return;
    }

    if (lastLookedUpPhoneRef.current === cleanCustomerPhone) {
      return;
    }
    lastLookedUpPhoneRef.current = cleanCustomerPhone;

    let cancelled = false;
    setLookingUpLoyalty(true);

    fetch(apiUrl('/api/manager/loyalty/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanCustomerPhone }),
    })
      .then(res => res.json())
      .then((data: LoyaltyLookupResult) => {
        if (cancelled) return;
        if (data && data.phone === cleanCustomerPhone) {
          setLoyaltyData(data);
          if (data.name) {
            setCustomerName(prev => (prev.trim() ? prev : data.name || ''));
          }
        }
      })
      .catch(err => {
        if (!cancelled) console.warn('Loyalty lookup error:', err);
      })
      .finally(() => {
        if (!cancelled) setLookingUpLoyalty(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanCustomerPhone, isOpen]);

  // Auto-select first coffee item if free visit unlocked
  useEffect(() => {
    if (loyaltyData?.is_free_visit && coffeeItems.length > 0 && !selectedFreeCoffeeId) {
      setSelectedFreeCoffeeId(coffeeItems[0].id);
    }
  }, [loyaltyData?.is_free_visit, coffeeItems, selectedFreeCoffeeId]);

  // Calculate free coffee deduction if selected
  const freeCoffeeDiscount = useMemo(() => {
    if (!loyaltyData?.is_free_visit || !selectedFreeCoffeeId) return 0;
    const item = coffeeItems.find(it => it.id === selectedFreeCoffeeId);
    return item ? Number(item.price_per_unit) || 0 : 0;
  }, [loyaltyData?.is_free_visit, selectedFreeCoffeeId, coffeeItems]);

  const rawSubtotal = allItems.reduce(
    (sum, item) => sum + item.price_per_unit * item.quantity,
    0
  );

  const totalDiscount = Math.min(rawSubtotal, discount + freeCoffeeDiscount);
  const taxEnabled = settings.tax_enabled ?? true;
  const gstRate = taxEnabled ? settings.gst_rate_percent ?? 5.0 : 0;
  const taxableAmount = Math.max(0, rawSubtotal - totalDiscount);
  const gstAmount = taxEnabled ? Math.round(((taxableAmount * gstRate) / 100) * 100) / 100 : 0;
  const finalTotal = taxableAmount + gstAmount;

  // When completed, trigger celebration confetti if free coffee awarded!
  useEffect(() => {
    if (completedBill?.is_loyalty_free_coffee || loyaltyData?.is_free_visit) {
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {
        // Confetti optional
      }
    }
  }, [completedBill, loyaltyData]);

  if (!isOpen) return null;

  async function handleCompleteBilling(e: React.FormEvent) {
    e.preventDefault();

    const cleanPhone = normalizePhoneNumber(customerPhone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg('Customer 10-digit phone number is required to process bill & save to Google Sheets.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('Customer name is required to process bill.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(apiUrl('/api/manager/bill'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          customer_name: customerName.trim() || 'Guest',
          customer_phone: cleanPhone,
          payment_mode: paymentMode,
          discount: Number(discount) || 0,
          free_coffee_item_id: loyaltyData?.is_free_visit ? selectedFreeCoffeeId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Billing failed. Please try again.');
      } else {
        setCompletedBill(data.bill);
        setCompletedItems(data.items || allItems);
        setSheetsSynced(data.sheets_synced);
        onBillCompleted();
      }
    } catch {
      setErrorMsg('Failed to process bill. Please check connection.');
    } finally {
      setSubmitting(false);
    }
  }

  // Print Thermal Receipt
  function handlePrintReceipt() {
    window.print();
  }

  // Generate and Download PDF Invoice
  function handleDownloadPDF() {
    if (!completedBill) return;

    const is58mm = settings.receipt_paper_size === '58mm';
    const pageWidth = is58mm ? 58 : 80;
    const centerX = pageWidth / 2;
    const margin = 4;
    const maxLineX = pageWidth - margin;
    let y = 8;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidth, 230],
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(is58mm ? 9 : 11);
    doc.text(settings.cafe_name || 'Brew & Bites Cafe', centerX, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(is58mm ? 6.5 : 7.5);
    if (settings.cafe_address) {
      doc.text(settings.cafe_address, centerX, y, { align: 'center', maxWidth: pageWidth - 8 });
      y += 6;
    }
    if (settings.gst_number) {
      doc.text(`GSTIN: ${settings.gst_number}`, centerX, y, { align: 'center' });
      y += 4;
    }

    doc.line(margin, y, maxLineX, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(is58mm ? 7.5 : 8.5);
    doc.text(`ORDER ID: ${completedBill.invoice_number}`, margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(is58mm ? 6.5 : 7.5);
    doc.text(`Date: ${new Date(completedBill.created_at).toLocaleString('en-IN')}`, margin, y);
    y += 4;
    doc.text(`Table: ${table.table_number}`, margin, y);
    y += 4;
    doc.text(`Customer: ${completedBill.customer_name} (${completedBill.customer_phone})`, margin, y);
    y += 4;
    doc.text(`Payment Mode: ${paymentMode.toUpperCase()}`, margin, y);
    y += 4;

    // Visit count & Loyalty
    if (completedBill.customer_phone && completedBill.customer_phone !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text(`Visit Count: #${completedBill.visit_count}`, margin, y);
      y += 4;
      if (completedBill.is_loyalty_free_coffee) {
        doc.setTextColor(217, 119, 6);
        doc.text('** LOYALTY REWARD: FREE COFFEE EARNED! **', centerX, y, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
    }

    doc.line(margin, y, maxLineX, y);
    y += 4;

    // Items
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(is58mm ? 6.5 : 7.5);
    doc.text('Item', margin, y);
    doc.text('Qty', is58mm ? 32 : 46, y);
    doc.text('Total', maxLineX, y, { align: 'right' });
    y += 3.5;
    doc.line(margin, y, maxLineX, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    for (const item of completedItems) {
      const isFree = selectedFreeCoffeeId === item.id;
      const itemTotal = isFree
        ? '0.00 (FREE)'
        : Number(item.price_per_unit * item.quantity).toFixed(2);
      doc.text(item.item_name_en.substring(0, is58mm ? 18 : 28), margin, y);
      doc.text(String(item.quantity), is58mm ? 33 : 47, y);
      doc.text(`Rs. ${itemTotal}`, maxLineX, y, { align: 'right' });
      y += 4;
    }

    doc.line(margin, y, maxLineX, y);
    y += 4;

    // Totals
    const subtotalFormatted = Number(completedBill.subtotal).toFixed(2);
    const gstFormatted = Number(completedBill.gst_amount).toFixed(2);
    const totalFormatted = Number(completedBill.total_amount).toFixed(2);

    doc.text('Subtotal:', margin, y);
    doc.text(`Rs. ${subtotalFormatted}`, maxLineX, y, { align: 'right' });
    y += 4;

    if (completedBill.discount > 0) {
      const discountFormatted = Number(completedBill.discount).toFixed(2);
      doc.text('Discount (incl. loyalty):', margin, y);
      doc.text(`-Rs. ${discountFormatted}`, maxLineX, y, { align: 'right' });
      y += 4;
    }

    if (completedBill.gst_rate > 0) {
      doc.text(`GST (${completedBill.gst_rate}%):`, margin, y);
      doc.text(`Rs. ${gstFormatted}`, maxLineX, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(is58mm ? 8.5 : 9.5);
    doc.text('GRAND TOTAL:', margin, y);
    doc.text(`Rs. ${totalFormatted}`, maxLineX, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(is58mm ? 6 : 7);
    doc.text('Thank you for dining with us!', centerX, y, { align: 'center' });
    y += 4;
    doc.text(`Loyalty: After every ${settings.loyalty_every_n_visits || 5} visits, next visit has FREE coffee!`, centerX, y, { align: 'center' });

    doc.save(`${completedBill.invoice_number}.pdf`);
  }

  const loyaltyN = settings.loyalty_every_n_visits || 5;

  return (
    <div
      onClick={() => !submitting && onClose()}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 sm:p-4 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-stone-900 border border-stone-800 text-stone-100 shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] pb-[env(safe-area-inset-bottom)] animate-slide-up sm:animate-scale-up"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-base">Counter Billing — {table.table_number}</h3>
              <p className="text-xs text-amber-100 font-mono">PIN: {session.pin_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {completedBill ? (
            /* Bill Completed / Invoice View */
            <div className="space-y-4">
              <div className="text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-1 animate-scale-up" />
                <h4 className="text-xl font-black text-white">Bill Settled &amp; Session Closed!</h4>
                <div className="inline-block mt-1 px-3 py-1 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Order ID: {completedBill.invoice_number}
                  </span>
                </div>
                {sheetsSynced && (
                  <p className="mt-2 text-xs font-semibold text-emerald-400">
                    ✓ Synced to Google Sheets (Orders, OrderItems, Customers)
                  </p>
                )}
              </div>

              {/* Loyalty Banner */}
              {completedBill.customer_phone && completedBill.customer_phone !== 'N/A' && (
                <div
                  className={`p-4 rounded-2xl border text-center ${
                    completedBill.is_loyalty_free_coffee
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md'
                      : 'bg-stone-800/60 text-stone-300 border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Coffee className="w-5 h-5 text-amber-400" />
                    <span className="font-black text-sm uppercase tracking-wider text-amber-400">
                      Customer Visit #{completedBill.visit_count}
                    </span>
                  </div>
                  {completedBill.is_loyalty_free_coffee ? (
                    <p className="font-bold text-sm text-amber-300">
                      🎉 Free Coffee Reward Awarded for Visit #{completedBill.visit_count}!
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400">
                      {loyaltyN - ((completedBill.visit_count - 1) % loyaltyN)} more visit(s) until next FREE Coffee!
                    </p>
                  )}
                </div>
              )}

              {/* Thermal Receipt Preview */}
              <div
                id="thermal-receipt-preview"
                className={`mx-auto bg-white text-stone-950 p-4 border border-stone-300 rounded-2xl font-mono text-xs shadow-lg ${
                  settings.receipt_paper_size === '58mm' ? 'max-w-[280px]' : 'max-w-[340px]'
                }`}
              >
                <div className="text-center pb-2 border-b border-dashed border-stone-300">
                  <h4 className="font-black text-sm">{settings.cafe_name}</h4>
                  <p className="text-[10px] text-stone-600">{settings.cafe_address}</p>
                  {settings.gst_number && (
                    <p className="text-[10px] text-stone-600">GSTIN: {settings.gst_number}</p>
                  )}
                </div>

                <div className="py-2 border-b border-dashed border-stone-300 space-y-0.5 text-[11px]">
                  <p className="font-bold">ID: {completedBill.invoice_number}</p>
                  <p>Table: {table.table_number}</p>
                  <p>Customer: {completedBill.customer_name}</p>
                  <p>Phone: {completedBill.customer_phone}</p>
                  <p>Mode: {paymentMode.toUpperCase()}</p>
                  {completedBill.customer_phone !== 'N/A' && (
                    <p>Visit #{completedBill.visit_count}</p>
                  )}
                </div>

                <div className="py-2 border-b border-dashed border-stone-300 space-y-1">
                  {completedItems.map(item => {
                    const isFree = selectedFreeCoffeeId === item.id;
                    return (
                      <div key={item.id} className="flex justify-between text-[11px]">
                        <span>
                          {item.quantity}x {item.item_name_en}
                          {isFree && <span className="text-emerald-600 ml-1 font-bold">(FREE)</span>}
                        </span>
                        <span>
                          ₹{isFree ? '0.00' : Number(item.price_per_unit * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{Number(completedBill.subtotal).toFixed(2)}</span>
                  </div>
                  {completedBill.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount (incl. free coffee):</span>
                      <span>-₹{Number(completedBill.discount).toFixed(2)}</span>
                    </div>
                  )}
                  {completedBill.gst_rate > 0 && (
                    <div className="flex justify-between">
                      <span>GST ({completedBill.gst_rate}%):</span>
                      <span>₹{Number(completedBill.gst_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-300">
                    <span>TOTAL:</span>
                    <span>₹{Number(completedBill.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-stone-500">
                  <p>Format: {settings.receipt_paper_size} Thermal</p>
                  <p>Thank you for visiting {settings.cafe_name}!</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt ({settings.receipt_paper_size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="flex-1 py-3 px-4 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          ) : (
            /* Billing Form */
            <form onSubmit={handleCompleteBilling} className="space-y-4">
              {/* Order Items summary */}
              <div>
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2">
                  Consolidated Orders ({allItems.length} items)
                </label>
                <div className="max-h-36 overflow-y-auto border border-stone-800 rounded-2xl p-3 bg-stone-950/70 space-y-1.5">
                  {allItems.map(it => {
                    const isSelectedFree = selectedFreeCoffeeId === it.id;
                    return (
                      <div key={it.id} className="flex justify-between text-xs items-center">
                        <span className="text-stone-300">
                          <strong className="text-white mr-1.5">{it.quantity}x</strong>
                          {it.item_name_en}
                          {isSelectedFree && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              FREE COFFEE (₹0)
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            isSelectedFree ? 'text-emerald-400 line-through' : 'text-amber-400'
                          }`}
                        >
                          ₹{it.price_per_unit * it.quantity}
                        </span>
                      </div>
                    );
                  })}
                  {allItems.length === 0 && (
                    <p className="text-xs text-stone-500 italic">No non-cancelled items in this session.</p>
                  )}
                </div>
              </div>

              {/* Customer Info Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-200">
                      Customer Phone <span className="text-amber-400 font-black">*</span>
                    </label>
                    {lookingUpLoyalty && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking Sheets...
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit number"
                    value={customerPhone}
                    onChange={e => {
                      const clean = normalizePhoneNumber(e.target.value);
                      setCustomerPhone(clean.slice(0, 10));
                    }}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl bg-stone-800 border text-white focus:outline-hidden font-mono ${
                      errorMsg && (!customerPhone || normalizePhoneNumber(customerPhone).length !== 10)
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : 'border-stone-700 focus:border-amber-500'
                    }`}
                  />
                  <span className="text-[10px] text-stone-400 block mt-1">
                    Required for bill, loyalty stamps &amp; Google Sheets
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-200 mb-1">
                    Customer Name <span className="text-amber-400 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl bg-stone-800 border text-white focus:outline-hidden ${
                      errorMsg && !customerName.trim()
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : 'border-stone-700 focus:border-amber-500'
                    }`}
                  />
                  <span className="text-[10px] text-stone-400 block mt-1">
                    Required for invoice &amp; customer directory
                  </span>
                </div>
              </div>

              {/* ======================================================== */}
              {/* LOYALTY STAMP CARD & FREE VISIT BADGE                    */}
              {/* ======================================================== */}
              {loyaltyData && (
                <div className="space-y-3 p-4 rounded-2xl bg-stone-950 border border-stone-800">
                  {/* Badge & Info Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">
                        Loyalty Stamp Card — {loyaltyData.previous_visits} Past Visits
                      </span>
                    </div>

                    {loyaltyData.is_free_visit ? (
                      <span className="px-2.5 py-1 rounded-full bg-linear-to-r from-amber-500 to-amber-600 text-stone-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/20 animate-pulse">
                        <Sparkles className="w-3 h-3" />
                        FREE visit
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-400/90">
                        Visit #{loyaltyData.new_count}
                      </span>
                    )}
                  </div>

                  {/* Stamp Card Circles */}
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {Array.from({ length: loyaltyData.stamps_total }).map((_, idx) => {
                      const stampNum = idx + 1;
                      const isStamped = stampNum <= loyaltyData.stamps_earned;
                      const isFreeStampSlot = stampNum === loyaltyData.stamps_total;

                      return (
                        <div
                          key={idx}
                          className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-1 transition-all ${
                            isStamped
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-inner'
                              : 'border-dashed border-stone-700 bg-stone-900/40 text-stone-600'
                          }`}
                        >
                          {isStamped ? (
                            <>
                              <Coffee className="w-4 h-4 text-amber-400" />
                              <span className="text-[10px] font-bold font-mono">#{stampNum}</span>
                            </>
                          ) : (
                            <>
                              {isFreeStampSlot ? (
                                <Gift className="w-4 h-4 text-amber-400/50" />
                              ) : (
                                <Coffee className="w-4 h-4 opacity-30" />
                              )}
                              <span className="text-[9px] font-mono">
                                {isFreeStampSlot ? 'FREE' : `#${stampNum}`}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* FREE visit Notification & Coffee Picker */}
                  {loyaltyData.is_free_visit && (
                    <div className="mt-2 pt-2 border-t border-stone-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Customer earned a FREE coffee! Pick 1 coffee to set to ₹0:</span>
                      </div>

                      {coffeeItems.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {coffeeItems.map(c => {
                            const isChosen = selectedFreeCoffeeId === c.id;
                            return (
                              <label
                                key={c.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                                  isChosen
                                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                                    : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="radio"
                                    name="freeCoffeeOption"
                                    value={c.id}
                                    checked={isChosen}
                                    onChange={() => setSelectedFreeCoffeeId(c.id)}
                                    className="accent-amber-500"
                                  />
                                  <span className="text-xs font-bold">{c.item_name_en}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-mono line-through text-stone-500 mr-1.5">
                                    ₹{c.price_per_unit}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-emerald-400">
                                    ₹0 (FREE)
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-200/80 bg-amber-950/40 p-2.5 rounded-xl border border-amber-900/40">
                          ℹ️ No coffee item in this table order. You can ask the customer if they would like to add a coffee, or continue without applying a free coffee.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
                  Payment Mode (Record Only)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                    { id: 'card', label: 'Card / POS', icon: CreditCard },
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = paymentMode === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPaymentMode(m.id as 'cash' | 'UPI' | 'card')}
                        className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-500/20'
                            : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:border-stone-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount Input */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Additional Manager Discount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  max={rawSubtotal}
                  value={discount || ''}
                  placeholder="0"
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-stone-800 border border-stone-700 text-white focus:outline-hidden focus:border-amber-500 font-mono"
                />
              </div>

              {/* Computation Breakdown */}
              <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800 space-y-1.5 text-xs text-stone-300">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-white">₹{rawSubtotal}</span>
                </div>
                {freeCoffeeDiscount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Loyalty Free Coffee Reward:</span>
                    <span className="font-mono font-bold">-₹{freeCoffeeDiscount}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Manager Discount:</span>
                    <span className="font-mono">-₹{discount}</span>
                  </div>
                )}
                {taxEnabled && (
                  <div className="flex justify-between">
                    <span>GST ({gstRate}%):</span>
                    <span className="font-mono font-semibold text-white">₹{gstAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-stone-800">
                  <span>Total Payable:</span>
                  <span className="text-amber-400 font-mono">₹{finalTotal}</span>
                </div>
              </div>

              {/* Consent Line Requirement */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Your data is used only for billing and loyalty</span>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl border border-stone-700 font-semibold text-xs text-stone-400 hover:bg-stone-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || allItems.length === 0}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-black text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                  ) : (
                    `Complete Bill & Close Table (₹${finalTotal})`
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
