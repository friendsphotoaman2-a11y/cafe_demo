import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_token = body.session_token || body.sessionToken;
    const session_id = body.session_id || body.sessionId;
    const rawNote = body.note || '';
    const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 100) : null;

    if (!session_token && !session_id) {
      return NextResponse.json(
        { success: false, message: 'Session is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch active session
    let sessionQuery = supabaseAdmin.from('table_sessions').select('id, table_id, status, session_token');
    if (session_id) {
      sessionQuery = sessionQuery.eq('id', session_id);
    } else {
      sessionQuery = sessionQuery.eq('session_token', session_token);
    }

    const { data: session, error: sessErr } = await sessionQuery.maybeSingle();

    if (sessErr || !session || session.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Session is closed or invalid.' },
        { status: 400 }
      );
    }

    // 2. Check 45-second cooldown per table
    const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString();
    const { data: recentCalls } = await supabaseAdmin
      .from('waiter_calls')
      .select('id, created_at')
      .eq('table_id', session.table_id)
      .gte('created_at', fortyFiveSecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentCalls && recentCalls.length > 0) {
      const lastCallTime = new Date(recentCalls[0].created_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - lastCallTime) / 1000);
      const remainingCooldown = Math.max(1, 45 - elapsedSeconds);

      return NextResponse.json(
        {
          success: false,
          cooldown: true,
          remaining_seconds: remainingCooldown,
          message: `Staff was already notified! Please wait ${remainingCooldown}s before calling again.`,
        },
        { status: 200 }
      );
    }

    // 3. Try call_waiter RPC (taking session_id, note)
    let rpcSuccess = false;
    const { data: cwData, error: cwErr } = await supabaseAdmin.rpc('call_waiter', {
      session_id: session.id,
      note: note,
    });

    if (!cwErr && cwData) {
      rpcSuccess = true;
    } else {
      // Fallback to call_waiter_service (taking p_session_token, p_note)
      const { data: cwsData, error: cwsErr } = await supabaseAdmin.rpc('call_waiter_service', {
        p_session_token: session.session_token,
        p_note: note,
      });

      if (!cwsErr && cwsData && (cwsData as { success?: boolean }).success !== false) {
        rpcSuccess = true;
      }
    }

    // 4. Fallback direct insert if RPC not present
    if (!rpcSuccess) {
      const { data: tableData } = await supabaseAdmin
        .from('cafe_tables')
        .select('table_number')
        .eq('id', session.table_id)
        .maybeSingle();

      const tableNumber = tableData?.table_number || 'Table';

      const { error: insErr } = await supabaseAdmin.from('waiter_calls').insert({
        session_id: session.id,
        table_id: session.table_id,
        table_number: tableNumber,
        note: note,
        status: 'PENDING',
      });

      if (insErr) {
        console.error('Error inserting waiter call:', insErr);
        return NextResponse.json(
          { success: false, message: 'Could not alert staff. Please wave down a server.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Waiter is on the way',
    });
  } catch (err: unknown) {
    console.error('Call waiter API error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error while calling waiter.' },
      { status: 500 }
    );
  }
}
