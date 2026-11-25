import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveTableAccess } from '@/lib/table-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table_code = (body.table_code || body.tableCode || '').trim();
    const pin = (body.pin || body.pin_code || '').trim();
    const sessionId = (body.session_id || body.sessionId || '').trim();
    const sessionToken = (body.session_token || body.sessionToken || '').trim();

    if (!table_code) {
      return NextResponse.json(
        {
          success: false,
          message: 'Table code is required.',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Check single server-side access resolver first
    const accessResult = await resolveTableAccess(table_code, { sessionId, sessionToken });

    if (accessResult.access === 'not_found') {
      return NextResponse.json(
        { success: false, access: 'not_found', message: 'Table not found' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (accessResult.access === 'error') {
      return NextResponse.json(
        { success: false, access: 'error', message: accessResult.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // If PIN is OFF (or saved session is already valid), grant access without checking PIN
    if (accessResult.access === 'granted') {
      const supabaseAdmin = createAdminClient();
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', accessResult.session_id)
        .order('created_at', { ascending: false });
      return NextResponse.json(
        { success: true, ...accessResult, orders: orders || [] },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    // PIN ON MODE: PIN is required
    if (!pin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Call verify_table_pin RPC directly (enforces 5-attempt lockout on server)
    const { data: vData, error: vError } = await supabaseAdmin.rpc('verify_table_pin', {
      p_table_code: table_code,
      p_pin: pin,
    });

    if (vError || !vData) {
      console.error('RPC Error verifying table PIN:', vError);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const rpcData = vData as Record<string, unknown>;

    // Standardize error message when PIN/table is invalid
    if (!rpcData.success && !rpcData.locked) {
      rpcData.message = 'Invalid PIN. Please talk to the manager and get your PIN again.';
    } else if (rpcData.success && rpcData.session_id) {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', String(rpcData.session_id))
        .order('created_at', { ascending: false });
      rpcData.orders = orders || [];
    }

    return NextResponse.json(rpcData, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('verify-pin API route error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
