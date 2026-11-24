import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  syncBillToGoogleSheets,
  lookupCustomerPhoneInSheet,
  getNextDailyOrderSequenceFromSheet,
} from '@/lib/google-sheets';
import { invalidateSheetsCache } from '@/lib/sheets-cache';
import { Bill, OrderItem } from '@/types/database';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const {
      session_id,
      customer_name,
      customer_phone,
      payment_mode = 'cash',
      discount = 0,
      free_coffee_item_id,
    } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { success: false, message: 'Session ID is required.' },
        { status: 400 }
      );
    }

    const cleanName = (customer_name || 'Guest').trim();
    const cleanPhone = normalizePhoneNumber(customer_phone || '');

    if (cleanPhone && cleanPhone.length !== 10) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid phone number. Please enter a valid 10-digit mobile number.',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch active session + table
    const { data: sessionRow, error: sessionErr } = await supabaseAdmin
      .from('table_sessions')
      .select('*, cafe_tables(*)')
      .eq('id', session_id)
      .single();

    if (sessionErr || !sessionRow) {
      return NextResponse.json(
        { success: false, message: 'Active session not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch manager settings
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    let prefix = 'ORD-';
    let taxEnabled = true;
    let loyaltyN = 5;
    const taxRate = Number(settingsRow?.gst_rate_percent) || 5.0;
    const sheetId = settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID || null;

    if (settingsRow?.cafe_tagline) {
      try {
        if (settingsRow.cafe_tagline.trim().startsWith('{')) {
          const meta = JSON.parse(settingsRow.cafe_tagline);
          if (meta.order_id_prefix) prefix = meta.order_id_prefix.trim();
          if (meta.tax_enabled !== undefined) taxEnabled = Boolean(meta.tax_enabled);
          if (meta.loyalty_every_n_visits) loyaltyN = Number(meta.loyalty_every_n_visits) || 5;
        }
      } catch {
        // Fallback defaults
      }
    }
    if (!prefix.endsWith('-')) prefix += '-';

    // 3. Generate unique Order ID strictly from Google Sheets Orders tab sequence
    const now = new Date();
    const istOptions = { timeZone: 'Asia/Kolkata' };
    const day = String(now.toLocaleDateString('en-GB', { day: '2-digit', ...istOptions }));
    const month = String(now.toLocaleDateString('en-GB', { month: '2-digit', ...istOptions }));
    const year = String(now.toLocaleDateString('en-GB', { year: '2-digit', ...istOptions }));
    const dateStr = `${day}${month}${year}`;

    const dailyCounter = await getNextDailyOrderSequenceFromSheet(prefix, dateStr, sheetId);
    const uniqueOrderId = `${prefix}${dateStr}-${dailyCounter}`;

    // 4. Fetch live order items for this active session
    const { data: orderRecords } = await supabaseAdmin
      .from('orders')
      .select('id, order_items(*)')
      .eq('session_id', session_id);

    const orderItems: OrderItem[] = [];
    if (orderRecords) {
      for (const order of orderRecords) {
        if (order.order_items && Array.isArray(order.order_items)) {
          orderItems.push(...(order.order_items as OrderItem[]));
        }
      }
    }

    const nonCancelledItems = orderItems.filter(it => it.status !== 'CANCELLED');

    let baseDiscount = Number(discount) || 0;
    let isFreeCoffeeAwarded = false;
    if (free_coffee_item_id) {
      const freeItem = nonCancelledItems.find(it => it.id === free_coffee_item_id);
      if (freeItem) {
        baseDiscount += Number(freeItem.price_per_unit) || 0;
        isFreeCoffeeAwarded = true;
      }
    }

    const subtotal = nonCancelledItems.reduce(
      (sum, item) => sum + item.price_per_unit * item.quantity,
      0
    );
    const effectiveTaxRate = taxEnabled ? taxRate : 0;
    const taxableAmount = Math.max(0, subtotal - baseDiscount);
    const gstAmount = Math.round(((taxableAmount * effectiveTaxRate) / 100) * 100) / 100;
    const totalAmount = taxableAmount + gstAmount;

    // 5. Compute customer loyalty count strictly from Google Sheets Customers tab
    let visitCount = 1;
    let isLoyaltyFreeCoffee = false;
    if (cleanPhone && cleanPhone.length === 10) {
      const existingCustomer = await lookupCustomerPhoneInSheet(cleanPhone, sheetId);
      const prevVisits = existingCustomer.found ? existingCustomer.previousVisits : 0;
      visitCount = prevVisits + 1;
      if (prevVisits > 0 && prevVisits % loyaltyN === 0) {
        isLoyaltyFreeCoffee = true;
      }
    }

    const finalBillRow: Bill = {
      id: `sheet-bill-${uniqueOrderId}`,
      invoice_number: uniqueOrderId,
      session_id,
      table_id: sessionRow.table_id,
      table_number: sessionRow.cafe_tables?.table_number || 'Table',
      customer_name: cleanName,
      customer_phone: cleanPhone || 'N/A',
      subtotal,
      discount: baseDiscount,
      gst_rate: effectiveTaxRate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      visit_count: visitCount,
      is_loyalty_free_coffee: isLoyaltyFreeCoffee || isFreeCoffeeAwarded,
      synced_to_sheets: true,
      sheets_synced_at: now.toISOString(),
      created_at: now.toISOString(),
    };

    // 6. Write directly to Google Sheets synchronously (single source of truth)
    const syncResult = await syncBillToGoogleSheets(
      finalBillRow,
      nonCancelledItems,
      sheetId,
      payment_mode,
      free_coffee_item_id
    );

    if (!syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            syncResult.error ||
            syncResult.reason ||
            'Google Sheets sync failed. Bill was not settled.',
        },
        { status: 500 }
      );
    }

    // 7. Close the live table session (notifies open customer screens via Realtime)
    // and purge live session orders from Supabase so Supabase stays light (no completed order history stored)
    await supabaseAdmin
      .from('table_sessions')
      .update({ status: 'CLOSED', closed_at: now.toISOString() })
      .eq('id', session_id);

    await supabaseAdmin.from('orders').delete().eq('session_id', session_id);

    // 8. Invalidate all Sheets read caches so UI updates immediately
    invalidateSheetsCache();

    return NextResponse.json({
      success: true,
      order_id: finalBillRow.invoice_number,
      bill: finalBillRow,
      items: nonCancelledItems,
      payment_mode,
      sheets_synced: true,
    });
  } catch (err: unknown) {
    console.error('Billing error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal billing error.' },
      { status: 500 }
    );
  }
}
