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

    // 1. Fetch table details
    const { data: tableData, error: tableErr } = await supabaseAdmin
      .from('cafe_tables')
      .select('id, table_number, table_code')
      .ilike('table_code', table_code)
      .maybeSingle();

    if (tableErr || !tableData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid table code. Please check the QR code or talk to manager.',
        },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fetch current active session for this table
    const { data: sessionData, error: sessErr } = await supabaseAdmin
      .from('table_sessions')
      .select('id, pin_code, status, session_token, failed_attempts, locked_until')
      .eq('table_id', tableData.id)
      .eq('status', 'ACTIVE')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessErr || !sessionData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Table is not currently open. Please ask the manager to generate a PIN.',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const currentFailed = Number(sessionData.failed_attempts) || 0;
    const isCurrentlyLocked =
      currentFailed >= 5 ||
      Boolean(sessionData.locked_until && new Date(sessionData.locked_until) > new Date());

    // 3. If already reached 5 attempts or locked, block access permanently until manager generates new PIN
    if (isCurrentlyLocked) {
      return NextResponse.json(
        {
          success: false,
          locked: true,
          permanent_lock: true,
          attempts_left: 0,
          message:
            '5 बार गलत पिन दर्ज किया गया। यह पिन ब्लॉक हो गया है। कृपया मैनेजर से नया पिन लें। (5 wrong attempts exceeded. This PIN is blocked. Please get a new PIN from the manager.)',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 4. Validate PIN
    if (sessionData.pin_code === pin) {
      // Correct PIN: reset failed attempts
      await supabaseAdmin
        .from('table_sessions')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('id', sessionData.id);

      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', sessionData.id)
        .order('created_at', { ascending: false });

      return NextResponse.json(
        {
          success: true,
          session_token: sessionData.session_token,
          session_id: sessionData.id,
          table_id: tableData.id,
          table_number: tableData.table_number,
          table_code: tableData.table_code,
          orders: orders || [],
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 5. Incorrect PIN: Increment failed attempts
    const newFailed = currentFailed + 1;
    const maxAttempts = 5;

    if (newFailed >= maxAttempts) {
      // 5th failed attempt: Block PIN permanently until manager regenerates
      await supabaseAdmin
        .from('table_sessions')
        .update({
          failed_attempts: maxAttempts,
          locked_until: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', sessionData.id);

      return NextResponse.json(
        {
          success: false,
          locked: true,
          permanent_lock: true,
          attempts_left: 0,
          message:
            '5 बार गलत पिन दर्ज किया गया। यह पिन ब्लॉक हो गया है। कृपया मैनेजर से नया पिन लें। (5 wrong attempts exceeded. This PIN is blocked. Please get a new PIN from the manager.)',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Still has attempts left
    const attemptsLeft = maxAttempts - newFailed;
    await supabaseAdmin
      .from('table_sessions')
      .update({ failed_attempts: newFailed })
      .eq('id', sessionData.id);

    return NextResponse.json(
      {
        success: false,
        locked: false,
        attempts_left: attemptsLeft,
        message: `गलत पिन! केवल ${attemptsLeft} प्रयास शेष हैं। (Invalid PIN. Only ${attemptsLeft} attempt(s) remaining.)`,
      },
      { headers: NO_CACHE_HEADERS }
    );
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
