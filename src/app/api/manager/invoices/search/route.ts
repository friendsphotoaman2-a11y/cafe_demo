import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchInvoiceInSheet } from '@/lib/google-sheets';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { Bill, OrderItem } from '@/types/database';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || searchParams.get('query') || '').trim();

    if (!query) {
      return NextResponse.json(
        { success: false, message: 'Search query is required (Order ID or phone number).' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhoneNumber(query);
    const supabaseAdmin = createAdminClient();

    // 1. Fetch manager settings for Google Sheet ID
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const customSheetId = settingsRow?.google_sheet_id || null;

    // ---------------------------------------------------------------------------
    // STEP 1: Search Supabase bills (Last 30 days)
    // ---------------------------------------------------------------------------
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let supabaseQuery = supabaseAdmin
      .from('bills')
      .select('*')
      .gte('created_at', thirtyDaysAgo);

    if (cleanPhone && cleanPhone.length === 10) {
      supabaseQuery = supabaseQuery.or(
        `customer_phone.eq.${cleanPhone},invoice_number.ilike.%${query}%`
      );
    } else {
      supabaseQuery = supabaseQuery.ilike('invoice_number', `%${query}%`);
    }

    const { data: dbBills, error: dbErr } = await supabaseQuery
      .order('created_at', { ascending: false })
      .limit(1);

    if (!dbErr && dbBills && dbBills.length > 0) {
      const bill = dbBills[0] as Bill;

      // Fetch items for this bill from orders
      let items: OrderItem[] = [];
      if (bill.session_id) {
        const { data: orderData } = await supabaseAdmin
          .from('orders')
          .select('id, order_items(*)')
          .eq('session_id', bill.session_id);

        if (orderData) {
          for (const ord of orderData) {
            if (ord.order_items && Array.isArray(ord.order_items)) {
              items.push(...(ord.order_items as OrderItem[]));
            }
          }
        }
      }

      // Filter non-cancelled items
      items = items.filter(it => it.status !== 'CANCELLED');

      return NextResponse.json({
        success: true,
        found: true,
        source: 'supabase',
        bill,
        items,
      });
    }

    // ---------------------------------------------------------------------------
    // STEP 2: If not found in Supabase, search Google Sheets Orders and OrderItems
    // ---------------------------------------------------------------------------
    const sheetResult = await searchInvoiceInSheet(query, customSheetId);

    if (sheetResult.found && sheetResult.bill) {
      return NextResponse.json({
        success: true,
        found: true,
        source: 'google_sheets',
        bill: sheetResult.bill,
        items: sheetResult.items || [],
      });
    }

    // ---------------------------------------------------------------------------
    // STEP 3: Not found in either Supabase or Google Sheets
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      found: false,
      message: `No invoice found for "${query}" in Supabase (last 30 days) or Google Sheets archive.`,
    });
  } catch (err: unknown) {
    console.error('Invoice search error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal search error.' },
      { status: 500 }
    );
  }
}
