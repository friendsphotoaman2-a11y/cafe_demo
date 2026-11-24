import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchAllCustomerInvoicesFromSheet } from '@/lib/google-sheets';
import { normalizePhoneNumber } from '@/lib/phone-utils';
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

    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const customSheetId = settingsRow?.google_sheet_id || null;

    // Search strictly in Google Sheets (Orders, OrderItems, Customers tabs)
    const sheetResult = await searchAllCustomerInvoicesFromSheet(query, customSheetId);

    if (!sheetResult.found || (sheetResult.invoices.length === 0 && !sheetResult.customer)) {
      return NextResponse.json({
        success: true,
        found: false,
        message: `No invoice or customer record found for "${query}" in Google Sheets.`,
      });
    }

    const combinedInvoices = [...sheetResult.invoices].sort((a, b) => {
      const dateA = new Date(a.bill.created_at).getTime() || 0;
      const dateB = new Date(b.bill.created_at).getTime() || 0;
      return dateB - dateA;
    });

    const totalSpent =
      sheetResult.customer?.totalSpent ||
      combinedInvoices.reduce((sum, inv) => sum + (Number(inv.bill.total_amount) || 0), 0);

    const customerSummary = {
      name: sheetResult.customer?.name || combinedInvoices[0]?.bill.customer_name || 'Valued Customer',
      phone: sheetResult.customer?.phone || cleanPhone || combinedInvoices[0]?.bill.customer_phone || query,
      totalVisits: sheetResult.customer?.totalVisits || combinedInvoices.length,
      totalSpent,
      firstVisit:
        combinedInvoices.length > 0
          ? combinedInvoices[combinedInvoices.length - 1].bill.created_at
          : sheetResult.customer?.firstVisit || '',
      lastVisit:
        combinedInvoices.length > 0
          ? combinedInvoices[0].bill.created_at
          : sheetResult.customer?.lastVisit || '',
      freeRedeemed: sheetResult.customer?.freeRedeemed || 0,
    };

    return NextResponse.json({
      success: true,
      found: true,
      customer: customerSummary,
      invoices: combinedInvoices,
      bill: combinedInvoices[0]?.bill,
      items: combinedInvoices[0]?.items || [],
      source: 'google_sheets',
    });
  } catch (err: unknown) {
    console.error('Invoice search error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal search error.' },
      { status: 500 }
    );
  }
}
