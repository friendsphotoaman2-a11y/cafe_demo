import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSheetsClient } from '@/lib/google-sheets';
import { verifyManagerAuth } from '@/lib/auth-guard';

interface CachedOrderHistory {
  timestamp: number;
  data: Array<{
    order_id: string;
    date: string;
    time: string;
    table: string;
    customer_name: string;
    phone: string;
    items: string;
    subtotal: number;
    tax: number;
    total: number;
    payment_mode: string;
    status: string;
    completed_at: string;
    visit_no: number;
    free_visit: string;
  }>;
}

let historyCache: CachedOrderHistory | null = null;
const CACHE_TTL_MS = 45000; // 45 seconds cache to preserve Google Sheets quota

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const dateRange = (searchParams.get('dateRange') || '').trim(); // 'today' | '7days' | '30days' | 'all'
    const tableFilter = (searchParams.get('table') || '').trim().toLowerCase();
    const phoneFilter = (searchParams.get('phone') || '').trim().replace(/\D/g, '');
    const orderIdFilter = (searchParams.get('orderId') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(5, Math.min(100, parseInt(searchParams.get('pageSize') || '15', 10)));

    const now = Date.now();
    let allOrders: CachedOrderHistory['data'] = [];
    let isFromCache = false;

    if (!forceRefresh && historyCache && now - historyCache.timestamp < CACHE_TTL_MS) {
      allOrders = historyCache.data;
      isFromCache = true;
    } else {
      const supabaseAdmin = createAdminClient();
      const { data: settingsRow } = await supabaseAdmin
        .from('manager_settings')
        .select('google_sheet_id')
        .eq('id', 1)
        .maybeSingle();

      const spreadsheetId = settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID;

      if (spreadsheetId && spreadsheetId !== 'placeholder-sheet-id') {
        try {
          const sheets = getSheetsClient();
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Orders!A:O',
          });
          const rows = res.data.values || [];

          // Row 0 is headers
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            allOrders.push({
              order_id: (r[0] || '').toString(),
              date: (r[1] || '').toString(),
              time: (r[2] || '').toString(),
              table: (r[3] || '').toString(),
              customer_name: (r[4] || '').toString(),
              phone: (r[5] || '').toString(),
              items: (r[6] || '').toString(),
              subtotal: Number(r[7]) || 0,
              tax: Number(r[8]) || 0,
              total: Number(r[9]) || 0,
              payment_mode: (r[10] || 'COUNTER').toString(),
              status: (r[11] || 'COMPLETED').toString(),
              completed_at: (r[12] || '').toString(),
              visit_no: Number(r[13]) || 1,
              free_visit: (r[14] || 'NO').toString(),
            });
          }
        } catch (sheetErr) {
          console.warn('Error reading Orders from Sheet for Order History:', sheetErr);
        }
      }

      // Also merge any recent Supabase bills that may not have synced yet
      const { data: dbBills } = await supabaseAdmin
        .from('bills')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbBills && dbBills.length > 0) {
        const existingIds = new Set(allOrders.map(o => o.order_id.toLowerCase().trim()));
        for (const b of dbBills) {
          const inv = (b.invoice_number || '').toLowerCase().trim();
          if (inv && !existingIds.has(inv)) {
            const billDate = new Date(b.created_at);
            allOrders.unshift({
              order_id: b.invoice_number,
              date: billDate.toISOString().split('T')[0],
              time: billDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
              table: b.table_number || 'Table',
              customer_name: b.customer_name || 'Customer',
              phone: b.customer_phone || '',
              items: 'Recent Order',
              subtotal: Number(b.subtotal) || 0,
              tax: Number(b.gst_amount) || 0,
              total: Number(b.total_amount) || 0,
              payment_mode: 'COUNTER',
              status: 'COMPLETED',
              completed_at: b.created_at,
              visit_no: Number(b.visit_count) || 1,
              free_visit: b.is_loyalty_free_coffee ? 'YES' : 'NO',
            });
            existingIds.add(inv);
          }
        }
      }

      // Sort newest first by completed_at / date
      allOrders.sort((a, b) => {
        const timeA = new Date(a.completed_at || `${a.date} ${a.time}`).getTime() || 0;
        const timeB = new Date(b.completed_at || `${b.date} ${b.time}`).getTime() || 0;
        return timeB - timeA;
      });

      historyCache = {
        timestamp: now,
        data: allOrders,
      };
    }

    // Apply Filters
    let filtered = [...allOrders];

    // Date Range Filter
    if (dateRange && dateRange !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateRange === 'today') {
        filtered = filtered.filter(o => o.date === todayStr);
      } else if (dateRange === '7days') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filtered = filtered.filter(o => o.date >= sevenDaysAgo);
      } else if (dateRange === '30days') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
      filtered = filtered.filter(o => o.order_id.toLowerCase().includes(orderIdFilter));
    }

    // Pagination
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedOrders = filtered.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      orders: paginatedOrders,
      totalCount,
      page,
      totalPages,
      pageSize,
      cached: isFromCache,
      cacheAgeSec: Math.round((Date.now() - (historyCache?.timestamp || 0)) / 1000),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
