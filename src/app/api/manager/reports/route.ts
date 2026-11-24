import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Bill, OrderItem } from '@/types/database';
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

    const supabaseAdmin = createAdminClient();

    // 1. Fetch Manager Settings (for Google Sheet ID reference)
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const googleSheetId =
      settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID || '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY';

    // 2. Compute date range (bounded by 30 days max for Supabase bills)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let startDate: Date;
    let endDate: Date = new Date();

    if (range === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'yesterday') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_7_days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'last_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'custom' && customFrom) {
      startDate = new Date(customFrom);
      startDate.setHours(0, 0, 0, 0);
      if (customTo) {
        endDate = new Date(customTo);
        endDate.setHours(23, 59, 59, 999);
      }
      // Ensure we don't query before 30 days in Supabase
      if (startDate < thirtyDaysAgo) {
        startDate = thirtyDaysAgo;
      }
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    // 3. Query Supabase bills within date range
    const { data: rawBills, error: billsErr } = await supabaseAdmin
      .from('bills')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (billsErr) {
      console.error('Error fetching bills for reports:', billsErr);
      return NextResponse.json(
        { success: false, message: billsErr.message },
        { status: 500 }
      );
    }

    const bills: Bill[] = (rawBills as Bill[]) || [];

    // 4. Calculate Summary Metrics
    const billsCount = bills.length;
    const totalSales = bills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    const averageBill = billsCount > 0 ? Math.round(totalSales / billsCount) : 0;
    const totalTax = bills.reduce((sum, b) => sum + (Number(b.gst_amount) || 0), 0);
    const totalDiscount = bills.reduce((sum, b) => sum + (Number(b.discount) || 0), 0);

    // 5. Calculate Daily Sales
    const dailyMap = new Map<string, { total_sales: number; bills_count: number; dateObj: Date }>();

    for (const b of bills) {
      const d = new Date(b.created_at);
      const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const existing = dailyMap.get(dateKey) || { total_sales: 0, bills_count: 0, dateObj: d };
      existing.total_sales += Number(b.total_amount) || 0;
      existing.bills_count += 1;
      dailyMap.set(dateKey, existing);
    }

    const dailySales: DailySalesRecord[] = Array.from(dailyMap.entries())
      .map(([dateKey, val]) => ({
        date: dateKey,
        day_label: val.dateObj.toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Kolkata',
        }),
        bills_count: val.bills_count,
        total_sales: Math.round(val.total_sales),
        average_bill: Math.round(val.total_sales / Math.max(1, val.bills_count)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // 6. Calculate Table-wise Sales
    const tableMap = new Map<string, { total_sales: number; bills_count: number }>();

    for (const b of bills) {
      const tKey = b.table_number || 'Counter';
      const existing = tableMap.get(tKey) || { total_sales: 0, bills_count: 0 };
      existing.total_sales += Number(b.total_amount) || 0;
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

    // 7. Calculate Best-Selling Items for the chosen date range
    let bestSellingItems: BestSellingItemRecord[] = [];
    const sessionIds = Array.from(new Set(bills.map(b => b.session_id).filter(Boolean)));

    if (sessionIds.length > 0) {
      const { data: orderData } = await supabaseAdmin
        .from('orders')
        .select('id, session_id, order_items(*)')
        .in('session_id', sessionIds);

      const itemsMap = new Map<string, { name_en: string; name_hi: string; quantity: number; revenue: number }>();

      if (orderData) {
        for (const ord of orderData) {
          if (ord.order_items && Array.isArray(ord.order_items)) {
            for (const it of ord.order_items as OrderItem[]) {
              if (it.status !== 'CANCELLED') {
                const key = it.item_name_en || 'Unknown Item';
                const existing = itemsMap.get(key) || {
                  name_en: it.item_name_en,
                  name_hi: it.item_name_hi || '',
                  quantity: 0,
                  revenue: 0,
                };
                const qty = Number(it.quantity) || 1;
                const price = Number(it.price_per_unit) || 0;
                existing.quantity += qty;
                existing.revenue += qty * price;
                itemsMap.set(key, existing);
              }
            }
          }
        }
      }

      const totalItemsQty = Array.from(itemsMap.values()).reduce((sum, it) => sum + it.quantity, 0);

      bestSellingItems = Array.from(itemsMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 15) // Top 15
        .map((it, idx) => ({
          rank: idx + 1,
          name_en: it.name_en,
          name_hi: it.name_hi,
          quantity: it.quantity,
          revenue: Math.round(it.revenue),
          percentage: totalItemsQty > 0 ? Math.round((it.quantity / totalItemsQty) * 100) : 0,
        }));
    }

    return NextResponse.json({
      success: true,
      source: 'supabase_last_30_days',
      note: 'Showing data from Supabase bills for the last 30 days. Older historical records live in the Google Sheet.',
      google_sheet_id: googleSheetId,
      range,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      summary: {
        total_sales: Math.round(totalSales),
        bills_count: billsCount,
        average_bill: averageBill,
        total_tax: Math.round(totalTax),
        total_discount: Math.round(totalDiscount),
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
