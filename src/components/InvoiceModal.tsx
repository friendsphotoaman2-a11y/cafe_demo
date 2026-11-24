'use client';

import React from 'react';
import { Bill, OrderItem, ManagerSettings } from '@/types/database';
import { Printer, Download, X, Receipt, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatSheetDateTime } from '@/lib/date-utils';

interface Props {
  bill: Bill;
  items: OrderItem[];
  settings: ManagerSettings;
  source?: 'supabase' | 'google_sheets';
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceModal({
  bill,
  items,
  settings,
  source = 'google_sheets',
  isOpen,
  onClose,
}: Props) {
  if (!isOpen) return null;

  const is58mm = settings.receipt_paper_size === '58mm';

  // Print Thermal Receipt
  function handlePrintReceipt() {
    window.print();
  }

  // Generate and Download PDF Invoice
  function handleDownloadPDF() {
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
    doc.text(`ORDER ID: ${bill.invoice_number}`, margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(is58mm ? 6.5 : 7.5);
    doc.text(`Date: ${formatSheetDateTime(bill.created_at)}`, margin, y);
    y += 4;
    doc.text(`Table: ${bill.table_number}`, margin, y);
    y += 4;
    doc.text(`Customer: ${bill.customer_name} (${bill.customer_phone})`, margin, y);
    y += 4;

    // Visit count & Loyalty
    if (bill.customer_phone && bill.customer_phone !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text(`Visit Count: #${bill.visit_count}`, margin, y);
      y += 4;
      if (bill.is_loyalty_free_coffee) {
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
    for (const item of items) {
      const itemTotal = Number(item.price_per_unit * item.quantity).toFixed(2);
      doc.text(item.item_name_en.substring(0, is58mm ? 18 : 28), margin, y);
      doc.text(String(item.quantity), is58mm ? 33 : 47, y);
      doc.text(`Rs. ${itemTotal}`, maxLineX, y, { align: 'right' });
      y += 4;
    }

    doc.line(margin, y, maxLineX, y);
    y += 4;

    // Totals
    const subtotalFormatted = Number(bill.subtotal).toFixed(2);
    const gstFormatted = Number(bill.gst_amount).toFixed(2);
    const totalFormatted = Number(bill.total_amount).toFixed(2);

    doc.text('Subtotal:', margin, y);
    doc.text(`Rs. ${subtotalFormatted}`, maxLineX, y, { align: 'right' });
    y += 4;

    if (bill.discount > 0) {
      const discountFormatted = Number(bill.discount).toFixed(2);
      doc.text('Discount:', margin, y);
      doc.text(`-Rs. ${discountFormatted}`, maxLineX, y, { align: 'right' });
      y += 4;
    }

    if (bill.gst_rate > 0) {
      doc.text(`GST (${bill.gst_rate}%):`, margin, y);
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

    doc.save(`${bill.invoice_number}.pdf`);
  }

  return (
    <div
      onClick={onClose}
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
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Invoice Details</h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-blue-950 text-blue-200 border border-blue-700"
                  data-source={source}
                >
                  <FileSpreadsheet className="w-2.5 h-2.5" />
                  <span>Google Sheets</span>
                </span>
              </div>
              <p className="text-xs text-amber-100 font-mono">#{bill.invoice_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Thermal Receipt Visual Preview */}
          <div
            id="thermal-receipt-preview"
            className={`mx-auto bg-white text-stone-950 p-4 border border-stone-300 rounded-2xl font-mono text-xs shadow-lg ${
              is58mm ? 'max-w-[280px]' : 'max-w-[340px]'
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
              <p className="font-bold">ID: {bill.invoice_number}</p>
              <p>Date: {formatSheetDateTime(bill.created_at)}</p>
              <p>Table: {bill.table_number}</p>
              <p>Customer: {bill.customer_name}</p>
              <p>Phone: {bill.customer_phone}</p>
              {bill.customer_phone !== 'N/A' && <p>Visit #{bill.visit_count}</p>}
            </div>

            <div className="py-2 border-b border-dashed border-stone-300 space-y-1">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span>
                    {item.quantity}x {item.item_name_en}
                  </span>
                  <span>₹{Number(item.price_per_unit * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-[10px] text-stone-400 italic">No itemized details archived.</p>
              )}
            </div>

            <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{Number(bill.subtotal).toFixed(2)}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-₹{Number(bill.discount).toFixed(2)}</span>
                </div>
              )}
              {bill.gst_rate > 0 && (
                <div className="flex justify-between">
                  <span>GST ({bill.gst_rate}%):</span>
                  <span>₹{Number(bill.gst_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-300">
                <span>TOTAL:</span>
                <span>₹{Number(bill.total_amount).toFixed(2)}</span>
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
      </div>
    </div>
  );
}
