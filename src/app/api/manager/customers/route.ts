import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSheetsClient } from '@/lib/google-sheets';
import { verifyManagerAuth } from '@/lib/auth-guard';

interface CustomerRecord {
  phone: string;
  name: string;
  visit_count: number;
  first_visit: string;
  last_visit: string;
  total_spent: number;
}

interface CachedCustomers {
  timestamp: number;
  data: CustomerRecord[];
}

let customerCache: CachedCustomers | null = null;
const CACHE_TTL_MS = 45000;

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const query = (searchParams.get('q') || searchParams.get('query') || '').trim().toLowerCase();
    const cleanPhoneQuery = query.replace(/\D/g, '');

    const now = Date.now();
    let customers: CustomerRecord[] = [];
    let isFromCache = false;

    if (!forceRefresh && customerCache && now - customerCache.timestamp < CACHE_TTL_MS) {
      customers = customerCache.data;
      isFromCache = true;
    } else {
      const supabaseAdmin = createAdminClient();
      const { data: settingsRow } = await supabaseAdmin
        .from('manager_settings')
        .select('google_sheet_id')
        .eq('id', 1)
        .maybeSingle();

      const spreadsheetId = settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID;

      let sheetFetchSuccess = false;
      if (spreadsheetId && spreadsheetId !== 'placeholder-sheet-id') {
        try {
          const sheets = getSheetsClient();
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Customers!A:F',
          });
          const rows = res.data.values || [];

          // Row 0 is headers: phone, name, visit_count, first_visit, last_visit, total_spent
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            customers.push({
              phone: (r[0] || '').toString(),
              name: (r[1] || 'Valued Customer').toString(),
              visit_count: Number(r[2]) || 1,
              first_visit: (r[3] || '').toString(),
              last_visit: (r[4] || '').toString(),
              total_spent: Number(r[5]) || 0,
            });
          }
          sheetFetchSuccess = true;
        } catch (sheetErr) {
          console.warn('Error reading Customers from Google Sheet:', sheetErr);
        }
      }

      // Fallback to Supabase bills ONLY if Google Sheet could not be reached / is not configured
      if (!sheetFetchSuccess) {
        const { data: dbBills } = await supabaseAdmin
          .from('bills')
          .select('customer_phone, customer_name, visit_count, created_at, total_amount')
          .not('customer_phone', 'is', null)
          .order('created_at', { ascending: false });

        if (dbBills && dbBills.length > 0) {
          const custMap = new Map<string, CustomerRecord>();
          for (const b of dbBills) {
            const cleanPhone = (b.customer_phone || '').replace(/\D/g, '');
            if (!cleanPhone || cleanPhone.length < 10) continue;

            if (!custMap.has(cleanPhone)) {
              const newCust: CustomerRecord = {
                phone: b.customer_phone!,
                name: b.customer_name || 'Valued Customer',
                visit_count: Number(b.visit_count) || 1,
                first_visit: b.created_at,
                last_visit: b.created_at,
                total_spent: Number(b.total_amount) || 0,
              };
              custMap.set(cleanPhone, newCust);
              customers.push(newCust);
            } else {
              const existing = custMap.get(cleanPhone)!;
              if (b.visit_count && b.visit_count > existing.visit_count) {
                existing.visit_count = b.visit_count;
              }
            }
          }
        }
      }

      // Sort by last visit descending
      customers.sort((a, b) => {
        const timeA = new Date(a.last_visit).getTime() || 0;
        const timeB = new Date(b.last_visit).getTime() || 0;
        return timeB - timeA;
      });

      customerCache = {
        timestamp: now,
        data: customers,
      };
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
      customers: filtered,
      totalCount: filtered.length,
      cached: isFromCache,
      cacheAgeSec: Math.round((Date.now() - (customerCache?.timestamp || 0)) / 1000),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
