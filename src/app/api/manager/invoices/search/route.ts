import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchAllCustomerInvoicesFromSheet } from '@/lib/google-sheets';
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
    // STEP 1: Search ALL-TIME Supabase bills (NO 30-day cutoff!)
    // ---------------------------------------------------------------------------
    let supabaseQuery = supabaseAdmin
      .from('bills')
      .select('*');

    if (cleanPhone && cleanPhone.length === 10) {
      supabaseQuery = supabaseQuery.or(
        `customer_phone.eq.${cleanPhone},invoice_number.ilike.%${query}%,customer_name.ilike.%${query}%`
      );
    } else {
      supabaseQuery = supabaseQuery.or(
        `invoice_number.ilike.%${query}%,customer_name.ilike.%${query}%`
      );
    }

    const { data: dbBills, error: dbErr } = await supabaseQuery
      .order('created_at', { ascending: false });

    const supabaseInvoices: Array<{
      bill: Bill;
      items: OrderItem[];
      source: 'supabase';
    }> = [];

    if (!dbErr && dbBills && dbBills.length > 0) {
      // Gather session_ids to fetch items
      const sessionIds = dbBills.map(b => b.session_id).filter(Boolean);
      
      let allOrders: Array<{ session_id: string; order_items: OrderItem[] }> = [];
      if (sessionIds.length > 0) {
        const { data: orderData } = await supabaseAdmin
          .from('orders')
          .select('id, session_id, order_items(*)')
          .in('session_id', sessionIds);
        
        if (orderData) {
          allOrders = orderData as unknown as Array<{ session_id: string; order_items: OrderItem[] }>;
        }
      }

      for (const b of dbBills) {
        const bill = b as Bill;
        const matchingOrders = allOrders.filter(o => o.session_id === bill.session_id);
        const billItems: OrderItem[] = [];
        for (const ord of matchingOrders) {
          if (ord.order_items && Array.isArray(ord.order_items)) {
            billItems.push(...(ord.order_items as OrderItem[]));
          }
        }
        supabaseInvoices.push({
          bill,
          items: billItems.filter(it => it.status !== 'CANCELLED'),
          source: 'supabase',
        });
      }
    }

    // ---------------------------------------------------------------------------
    // STEP 2: Search ALL-TIME Google Sheets archive (Orders & Customers tabs)
    // ---------------------------------------------------------------------------
    const sheetResult = await searchAllCustomerInvoicesFromSheet(query, customSheetId);

    // ---------------------------------------------------------------------------
    // STEP 3: Combine and Deduplicate by invoice_number
    // ---------------------------------------------------------------------------
    const invoiceMap = new Map<string, {
      bill: Bill;
      items: OrderItem[];
      source: 'supabase' | 'google_sheets';
    }>();

    // Supabase has fresh live data
    for (const inv of supabaseInvoices) {
      if (inv.bill.invoice_number) {
        invoiceMap.set(inv.bill.invoice_number.toLowerCase().trim(), inv);
      }
    }

    // Google Sheets adds historical archive data
    if (sheetResult.found && sheetResult.invoices) {
      for (const inv of sheetResult.invoices) {
        const invNum = (inv.bill.invoice_number || '').toLowerCase().trim();
        if (invNum && !invoiceMap.has(invNum)) {
          invoiceMap.set(invNum, inv);
        }
      }
    }

    const combinedInvoices = Array.from(invoiceMap.values());

    // Sort descending by created_at date
    combinedInvoices.sort((a, b) => {
      const dateA = new Date(a.bill.created_at).getTime() || 0;
      const dateB = new Date(b.bill.created_at).getTime() || 0;
      return dateB - dateA;
    });

    if (combinedInvoices.length === 0 && !sheetResult.customer) {
      return NextResponse.json({
        success: true,
        found: false,
        message: `No invoice or customer record found for "${query}" in Supabase or Google Sheets archive.`,
      });
    }

    // ---------------------------------------------------------------------------
    // STEP 4: Build Customer Summary Profile
    // ---------------------------------------------------------------------------
    let customerName = sheetResult.customer?.name || '';
    let customerPhone = sheetResult.customer?.phone || cleanPhone || '';
    let totalSpent = 0;
    let maxVisits = sheetResult.customer?.totalVisits || 0;

    for (const inv of combinedInvoices) {
      if (!customerName && inv.bill.customer_name && inv.bill.customer_name !== 'Guest') {
        customerName = inv.bill.customer_name;
      }
      if (!customerPhone && inv.bill.customer_phone && inv.bill.customer_phone !== 'N/A') {
        customerPhone = inv.bill.customer_phone;
      }
      totalSpent += Number(inv.bill.total_amount) || 0;
      if (inv.bill.visit_count && inv.bill.visit_count > maxVisits) {
        maxVisits = inv.bill.visit_count;
      }
    }

    if (maxVisits < combinedInvoices.length) {
      maxVisits = combinedInvoices.length;
    }

    const firstVisitDate = combinedInvoices.length > 0 
      ? combinedInvoices[combinedInvoices.length - 1].bill.created_at 
      : sheetResult.customer?.firstVisit || '';
    const lastVisitDate = combinedInvoices.length > 0 
      ? combinedInvoices[0].bill.created_at 
      : sheetResult.customer?.lastVisit || '';

    const customerSummary = {
      name: customerName || 'Valued Customer',
      phone: customerPhone || query,
      totalVisits: maxVisits || combinedInvoices.length,
      totalSpent,
      firstVisit: firstVisitDate,
      lastVisit: lastVisitDate,
      freeRedeemed: sheetResult.customer?.freeRedeemed || 0,
    };

    return NextResponse.json({
      success: true,
      found: true,
      customer: customerSummary,
      invoices: combinedInvoices,
      // Backwards compatibility for single-invoice inspector
      bill: combinedInvoices[0]?.bill,
      items: combinedInvoices[0]?.items || [],
      source: combinedInvoices[0]?.source || 'supabase',
    });
  } catch (err: unknown) {
    console.error('Invoice search error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal search error.' },
      { status: 500 }
    );
  }
}
