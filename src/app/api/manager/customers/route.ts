import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  readCustomersFromSheet,
  deleteCustomerFromSheet,
  deleteAllCustomersFromSheet,
  SheetCustomerRow,
} from '@/lib/google-sheets';
import { getSheetsCache, setSheetsCache, invalidateSheetsCache } from '@/lib/sheets-cache';
import { verifyManagerAuth } from '@/lib/auth-guard';

async function getSpreadsheetId(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  const { data: settingsRow } = await supabaseAdmin
    .from('manager_settings')
    .select('google_sheet_id')
    .eq('id', 1)
    .maybeSingle();
  return settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID || null;
}

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const query = (searchParams.get('q') || searchParams.get('query') || '').trim().toLowerCase();
    const cleanPhoneQuery = query.replace(/\D/g, '');

    let customers: SheetCustomerRow[] = [];
    let isFromCache = false;
    let cacheAgeSec = 0;

    const cached = getSheetsCache<SheetCustomerRow[]>('customers', forceRefresh);
    if (cached) {
      customers = cached.data;
      isFromCache = true;
      cacheAgeSec = cached.ageSec;
    } else {
      const supabaseAdmin = createAdminClient();
      const spreadsheetId = await getSpreadsheetId(supabaseAdmin);
      const sheetRes = await readCustomersFromSheet(spreadsheetId);

      if (!sheetRes.success) {
        return NextResponse.json(
          {
            success: false,
            sheetConnected: false,
            message: sheetRes.error || 'Could not read Customers from Google Sheet.',
          },
          { status: 502 }
        );
      }

      customers = sheetRes.customers;
      setSheetsCache('customers', customers);
    }

    let filtered = [...customers];
    if (query) {
      filtered = filtered.filter(c => {
        const phoneDigits = c.phone.replace(/\D/g, '');
        const nameLower = c.name.toLowerCase();
        return (
          (cleanPhoneQuery && phoneDigits.includes(cleanPhoneQuery)) ||
          nameLower.includes(query)
        );
      });
    }

    return NextResponse.json({
      success: true,
      sheetConnected: true,
      customers: filtered,
      totalCount: filtered.length,
      cached: isFromCache,
      cacheAgeSec,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    let phone = (searchParams.get('phone') || '').trim();
    let clearAll = searchParams.get('clearAll') === 'true';

    if (!phone && !clearAll) {
      try {
        const body = await req.json();
        phone = (body.phone || '').trim();
        clearAll = Boolean(body.clearAll);
      } catch {
        // No body
      }
    }

    if (!phone && !clearAll) {
      return NextResponse.json(
        { success: false, message: 'Provide phone or clearAll=true to delete.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const spreadsheetId = await getSpreadsheetId(supabaseAdmin);

    const sheetDel = clearAll
      ? await deleteAllCustomersFromSheet(spreadsheetId)
      : await deleteCustomerFromSheet(phone, spreadsheetId);

    if (!sheetDel.success) {
      return NextResponse.json(
        { success: false, message: sheetDel.error || 'Failed to delete customer from Google Sheet.' },
        { status: 500 }
      );
    }

    // Clean up any legacy Supabase customers rows if present
    try {
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (clearAll) {
        await supabaseAdmin.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } else if (digits) {
        await supabaseAdmin.from('customers').delete().eq('phone', digits);
      }
    } catch {
      // Ignore if customers table absent
    }

    invalidateSheetsCache('customers', 'reports');

    return NextResponse.json({
      success: true,
      deletedCount: sheetDel.deletedCount,
      message: clearAll
        ? `Cleared ${sheetDel.deletedCount} customers from Google Sheet.`
        : `Deleted customer ${phone} from Google Sheet.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
