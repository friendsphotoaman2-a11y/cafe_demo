import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';
import { ManagerSettings, TableSession } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function mergeManagerSettings(data: Record<string, unknown> | null): ManagerSettings | null {
  if (!data) return null;
  let meta: Record<string, unknown> = {};
  const tagline = typeof data.cafe_tagline === 'string' ? data.cafe_tagline : '';
  if (tagline.trim().startsWith('{')) {
    try {
      meta = JSON.parse(tagline);
    } catch {
      // Ignore plain text tagline
    }
  }

  return {
    ...(data as unknown as ManagerSettings),
    cafe_email: (data.cafe_email as string) ?? (meta.email as string) ?? 'contact@brewandbites.com',
    tax_enabled: (data.tax_enabled as boolean) ?? (meta.tax_enabled as boolean) ?? true,
    session_hours: (data.session_hours as number) ?? (meta.session_hours as number) ?? 2,
    loyalty_every_n_visits:
      (data.loyalty_every_n_visits as number) ?? (meta.loyalty_every_n_visits as number) ?? 5,
    order_id_prefix: (data.order_id_prefix as string) ?? (meta.order_id_prefix as string) ?? 'ORD-',
    require_pin:
      data.require_pin !== undefined
        ? Boolean(data.require_pin)
        : ((meta.require_pin as boolean) ?? true),
    table_pin_overrides:
      (meta.table_pin_overrides as Record<string, 'DEFAULT' | 'ON' | 'OFF'>) || {},
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const scope = new URL(req.url).searchParams.get('scope');
    const supabaseAdmin = createAdminClient();

    if (scope === 'kitchen') {
      const [tblRes, ordRes, setRes] = await Promise.all([
        supabaseAdmin.from('cafe_tables').select('*').order('table_number'),
        supabaseAdmin
          .from('orders')
          .select('*, order_items(*)')
          .in('status', ['PENDING', 'PREPARING', 'READY'])
          .order('created_at', { ascending: true }),
        supabaseAdmin.from('manager_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      return NextResponse.json(
        {
          success: true,
          tables: tblRes.data || [],
          orders: ordRes.data || [],
          settings: mergeManagerSettings(setRes.data as Record<string, unknown> | null),
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const [tblRes, sessRes, ordRes, itmRes, catRes, callRes, setRes] = await Promise.all([
      supabaseAdmin.from('cafe_tables').select('*').order('table_number'),
      supabaseAdmin.from('table_sessions').select('*').eq('status', 'ACTIVE'),
      supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('menu_items').select('*').order('name_en', { ascending: true }),
      supabaseAdmin.from('categories').select('*').order('display_order', { ascending: true }),
      supabaseAdmin
        .from('waiter_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin.from('manager_settings').select('*').eq('id', 1).maybeSingle(),
    ]);

    const sessionsMap: Record<string, TableSession> = {};
    (sessRes.data || []).forEach(s => {
      sessionsMap[s.table_id] = s as TableSession;
    });

    return NextResponse.json(
      {
        success: true,
        tables: tblRes.data || [],
        sessions: sessionsMap,
        orders: ordRes.data || [],
        menuItems: itmRes.data || [],
        categories: catRes.data || [],
        waiterCalls: callRes.data || [],
        settings: mergeManagerSettings(setRes.data as Record<string, unknown> | null),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error('Manager dashboard API error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
