import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  readOrdersFromSheet,
  deleteOrderFromSheet,
  deleteAllOrdersFromSheet,
  SheetOrderRow,
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
    const dateRange = (searchParams.get('dateRange') || '').trim();
    const tableFilter = (searchParams.get('table') || '').trim().toLowerCase();
    const phoneFilter = (searchParams.get('phone') || '').trim().replace(/\D/g, '');
    const orderIdFilter = (searchParams.get('orderId') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(5, Math.min(100, parseInt(searchParams.get('pageSize') || '15', 10)));

    let allOrders: SheetOrderRow[] = [];
    let isFromCache = false;
    let cacheAgeSec = 0;

    const cached = getSheetsCache<SheetOrderRow[]>('orderHistory', forceRefresh);
    if (cached) {
      allOrders = cached.data;
      isFromCache = true;
      cacheAgeSec = cached.ageSec;
    } else {
      const supabaseAdmin = createAdminClient();
      const spreadsheetId = await getSpreadsheetId(supabaseAdmin);
      const sheetRes = await readOrdersFromSheet(spreadsheetId);

      if (!sheetRes.success) {
        return NextResponse.json(
          {
            success: false,
            sheetConnected: false,
            message: sheetRes.error || 'Could not read Orders from Google Sheet.',
          },
          { status: 502 }
        );
      }

      allOrders = sheetRes.orders;
      setSheetsCache('orderHistory', allOrders);
    }

    let filtered = [...allOrders];

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (dateRange === 'today') {
        filtered = filtered.filter(o => o.date === todayStr);
      } else if (dateRange === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Kolkata',
        });
        filtered = filtered.filter(o => o.date >= sevenDaysAgo);
      } else if (dateRange === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Kolkata',
        });
        filtered = filtered.filter(o => o.date >= thirtyDaysAgo);
      }
    }

    if (tableFilter) {
      filtered = filtered.filter(o => o.table.toLowerCase().includes(tableFilter));
    }

    if (phoneFilter) {
      filtered = filtered.filter(o => o.phone.replace(/\D/g, '').includes(phoneFilter));
    }

    if (orderIdFilter) {
      filtered = filtered.filter(
        o =>
          o.order_id.toLowerCase().includes(orderIdFilter) ||
          o.customer_name.toLowerCase().includes(orderIdFilter)
      );
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedOrders = filtered.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      sheetConnected: true,
      orders: paginatedOrders,
      totalCount,
      page,
      totalPages,
      pageSize,
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
    let orderId = (searchParams.get('orderId') || '').trim();
    let clearAll = searchParams.get('clearAll') === 'true';

    if (!orderId && !clearAll) {
      try {
        const body = await req.json();
        orderId = (body.orderId || '').trim();
        clearAll = Boolean(body.clearAll);
      } catch {
        // No body
      }
    }

    if (!orderId && !clearAll) {
      return NextResponse.json(
        { success: false, message: 'Provide orderId or clearAll=true to delete.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const spreadsheetId = await getSpreadsheetId(supabaseAdmin);

    const sheetDel = clearAll
      ? await deleteAllOrdersFromSheet(spreadsheetId)
      : await deleteOrderFromSheet(orderId, spreadsheetId);

    if (!sheetDel.success) {
      return NextResponse.json(
        { success: false, message: sheetDel.error || 'Failed to delete from Google Sheet.' },
        { status: 500 }
      );
    }

    // Clean up any legacy Supabase bills / billed orders rows if present
    try {
      if (clearAll) {
        await supabaseAdmin.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('orders').delete().eq('status', 'BILLED');
      } else if (orderId) {
        await supabaseAdmin.from('bills').delete().ilike('invoice_number', orderId);
      }
    } catch {
      // Ignore if bills table doesn't exist or is empty
    }

    invalidateSheetsCache('orderHistory', 'reports', 'customers');

    return NextResponse.json({
      success: true,
      deletedCount: sheetDel.deletedCount,
      message: clearAll
        ? `Cleared ${sheetDel.deletedCount} orders from Google Sheet.`
        : `Deleted ${orderId} from Google Sheet.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
