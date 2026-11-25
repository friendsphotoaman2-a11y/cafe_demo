import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readOrdersFromSheet, readOrderItemsFromSheet, SheetOrderRow, SheetOrderItemRow } from '@/lib/google-sheets';
import { getSheetsCache, setSheetsCache } from '@/lib/sheets-cache';
import { verifyManagerAuth } from '@/lib/auth-guard';

export interface DailySalesRecord {
  date: string;
  day_label: string;
  bills_count: number;
  total_sales: number;
  average_bill: number;
}

export interface TableSalesRecord {
  table_number: string;
  bills_count: number;
  total_sales: number;
  average_bill: number;
  percentage: number;
}

export interface BestSellingItemRecord {
  rank: number;
  name_en: string;
  name_hi: string;
  quantity: number;
  revenue: number;
  percentage: number;
}

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get('range') || 'last_7_days').toLowerCase();
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const supabaseAdmin = createAdminClient();
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const googleSheetId =
      settingsRow?.google_sheet_id ||
      process.env.GOOGLE_SHEET_ID ||
      '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY';

    let orders: SheetOrderRow[] = [];
    let orderItems: SheetOrderItemRow[] = [];

    const cachedReport = getSheetsCache<{ orders: SheetOrderRow[]; orderItems: SheetOrderItemRow[] }>(
      'reports',
      forceRefresh
    );
    if (cachedReport) {
      orders = cachedReport.data.orders;
      orderItems = cachedReport.data.orderItems;
    } else {
      const [ordersRes, itemsRes] = await Promise.all([
        readOrdersFromSheet(googleSheetId),
        readOrderItemsFromSheet(googleSheetId),
      ]);

      if (!ordersRes.success) {
        return NextResponse.json(
          { success: false, message: ordersRes.error || 'Failed to read reports from Google Sheet.' },
          { status: 502 }
        );
      }

      orders = ordersRes.orders;
      orderItems = itemsRes.success ? itemsRes.items : [];
      setSheetsCache('reports', { orders, orderItems });
    }

    // Date bounds in IST (YYYY-MM-DD)
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    let startStr = '';
    let endStr = '9999-12-31';

    if (range === 'today') {
      startStr = todayStr;
      endStr = todayStr;
    } else if (range === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      startStr = yest;
      endStr = yest;
    } else if (range === 'last_7_days') {
      startStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      endStr = todayStr;
    } else if (range === 'last_30_days') {
      startStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      endStr = todayStr;
    } else if (range === 'custom') {
      startStr = customFrom || '';
      endStr = customTo || '9999-12-31';
    } else if (range === 'all_time') {
      startStr = '';
      endStr = '9999-12-31';
    }

    const filteredOrders = orders.filter(o => {
      if (!o.date) return range === 'all_time';
      if (startStr && o.date < startStr) return false;
      if (endStr && o.date > endStr) return false;
      return true;
    });

    const billsCount = filteredOrders.length;
    const totalSales = filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const averageBill = billsCount > 0 ? Math.round(totalSales / billsCount) : 0;
    const totalTax = filteredOrders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);

    // Daily Sales
    const dailyMap = new Map<string, { total_sales: number; bills_count: number }>();
    for (const o of filteredOrders) {
      const dateKey = o.date || todayStr;
      const existing = dailyMap.get(dateKey) || { total_sales: 0, bills_count: 0 };
      existing.total_sales += Number(o.total) || 0;
      existing.bills_count += 1;
      dailyMap.set(dateKey, existing);
    }

    const dailySales: DailySalesRecord[] = Array.from(dailyMap.entries())
      .map(([dateKey, val]) => {
        const parsedDate = new Date(`${dateKey}T12:00:00Z`);
        const dayLabel = isNaN(parsedDate.getTime())
          ? dateKey
          : parsedDate.toLocaleDateString('en-IN', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              timeZone: 'Asia/Kolkata',
            });
        return {
          date: dateKey,
          day_label: dayLabel,
          bills_count: val.bills_count,
          total_sales: Math.round(val.total_sales),
          average_bill: Math.round(val.total_sales / Math.max(1, val.bills_count)),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // Table-wise Sales
    const tableMap = new Map<string, { total_sales: number; bills_count: number }>();
    for (const o of filteredOrders) {
      const tKey = o.table || 'Counter';
      const existing = tableMap.get(tKey) || { total_sales: 0, bills_count: 0 };
      existing.total_sales += Number(o.total) || 0;
      existing.bills_count += 1;
      tableMap.set(tKey, existing);
    }

    const tableSales: TableSalesRecord[] = Array.from(tableMap.entries())
      .map(([tableNum, val]) => ({
        table_number: tableNum,
        bills_count: val.bills_count,
        total_sales: Math.round(val.total_sales),
        average_bill: Math.round(val.total_sales / Math.max(1, val.bills_count)),
        percentage: totalSales > 0 ? Math.round((val.total_sales / totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.total_sales - a.total_sales);

    // Best-Selling Items calculation
    const itemsMap = new Map<string, { name_en: string; name_hi: string; quantity: number; revenue: number }>();
    const itemRates = new Map<string, number>();
    for (const it of orderItems) {
      if (it.item_name && it.rate) {
        itemRates.set(it.item_name.trim().toLowerCase(), Number(it.rate) || 0);
      }
    }

    if (range === 'all') {
      for (const it of orderItems) {
        const key = it.item_name || 'Menu Item';
        itemsMap.set(key, {
          name_en: key,
          name_hi: '',
          quantity: Number(it.qty) || 0,
          revenue: Number(it.amount) || 0,
        });
      }
    } else {
      const itemRegex = /(\d+)x\s+([^,]+)/g;
      for (const o of filteredOrders) {
        if (!o.items) continue;
        let match: RegExpExecArray | null;
        while ((match = itemRegex.exec(o.items)) !== null) {
          const qty = Number(match[1]) || 1;
          const name = match[2].trim();
          const key = name.toLowerCase();
          const rate = itemRates.get(key) || (o.subtotal && qty ? Math.round(o.subtotal / qty) : 0);
          const existing = itemsMap.get(name) || {
            name_en: name,
            name_hi: '',
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += qty;
          existing.revenue += qty * rate;
          itemsMap.set(name, existing);
        }
      }
    }

    const totalItemsQty = Array.from(itemsMap.values()).reduce((sum, it) => sum + it.quantity, 0);
    const bestSellingItems: BestSellingItemRecord[] = Array.from(itemsMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 15)
      .map((it, idx) => ({
        rank: idx + 1,
        name_en: it.name_en,
        name_hi: it.name_hi,
        quantity: it.quantity,
        revenue: Math.round(it.revenue),
        percentage: totalItemsQty > 0 ? Math.round((it.quantity / totalItemsQty) * 100) : 0,
      }));

    return NextResponse.json({
      success: true,
      source: 'google_sheets_realtime',
      note: 'All metrics calculated live from your Google Sheets Orders & OrderItems tabs.',
      google_sheet_id: googleSheetId,
      range,
      summary: {
        total_sales: Math.round(totalSales),
        bills_count: billsCount,
        average_bill: averageBill,
        total_tax: Math.round(totalTax),
        total_discount: 0,
      },
      daily_sales: dailySales,
      table_sales: tableSales,
      best_selling_items: bestSellingItems,
    });
  } catch (err: unknown) {
    console.error('Reports API error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
