import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveTableAccess } from '@/lib/table-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_token = (body.session_token || body.sessionToken || '').trim();
    const session_id = (body.session_id || body.sessionId || '').trim();
    const table_code = (body.table_code || body.tableCode || '').trim().toUpperCase();
    const rawNote = body.note || '';
    const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 100) || null : null;

    if (!session_token && !session_id && !table_code) {
      return NextResponse.json(
        { success: false, message: 'Session is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch active session + table_number in a single query
    let session: {
      id: string;
      table_id: string;
      status: string;
      session_token: string;
      cafe_tables?: { table_number?: string } | { table_number?: string }[] | null;
    } | null = null;

    if (session_id || session_token) {
      let sessionQuery = supabaseAdmin
        .from('table_sessions')
        .select('id, table_id, status, session_token, cafe_tables(table_number)');
      if (session_id) {
        sessionQuery = sessionQuery.eq('id', session_id);
      } else {
        sessionQuery = sessionQuery.eq('session_token', session_token);
      }
      const { data } = await sessionQuery.maybeSingle();
      session = data;
    }

    let refreshedSession: { session_id: string; session_token: string } | null = null;
    let tableNumber = '';

    if (session?.cafe_tables) {
      const tblRel = Array.isArray(session.cafe_tables)
        ? session.cafe_tables[0]
        : session.cafe_tables;
      tableNumber = tblRel?.table_number || '';
    }

    // 2. If passed session is missing/closed, recover automatically in PIN-OFF mode or report closed cleanly
    if (!session || session.status !== 'ACTIVE') {
      if (table_code) {
        const accessResult = await resolveTableAccess(table_code);
        if (accessResult.access === 'granted') {
          session = {
            id: accessResult.session_id,
            table_id: accessResult.table_id,
            status: 'ACTIVE',
            session_token: accessResult.session_token,
          };
          tableNumber = accessResult.table_number;
          refreshedSession = {
            session_id: accessResult.session_id,
            session_token: accessResult.session_token,
          };
        } else if (accessResult.access === 'pin_required') {
          return NextResponse.json(
            {
              success: false,
              session_closed: true,
              message: 'Table session has ended. Please refresh or enter PIN.',
            },
            { status: 401 }
          );
        }
      }

      if (!session || session.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            success: false,
            session_closed: true,
            message: 'Session is closed or invalid.',
          },
          { status: 400 }
        );
      }
    }

    // 3. Check 30-second cooldown ONLY for unresolved (PENDING) waiter calls at this table
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: recentPendingCalls } = await supabaseAdmin
      .from('waiter_calls')
      .select('id, created_at')
      .eq('table_id', session.table_id)
      .eq('status', 'PENDING')
      .gte('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentPendingCalls && recentPendingCalls.length > 0) {
      const lastCallTime = new Date(recentPendingCalls[0].created_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - lastCallTime) / 1000);
      const remainingCooldown = Math.max(1, 30 - elapsedSeconds);

      return NextResponse.json(
        {
          success: false,
          cooldown: true,
          remaining_seconds: remainingCooldown,
          ...(refreshedSession ? { refreshed_session: refreshedSession } : {}),
          message: `Staff was already notified! Please wait ${remainingCooldown}s before calling again.`,
        },
        { status: 200 }
      );
    }

    if (!tableNumber) {
      const { data: tableData } = await supabaseAdmin
        .from('cafe_tables')
        .select('table_number')
        .eq('id', session.table_id)
        .maybeSingle();
      tableNumber = tableData?.table_number || 'Table';
    }

    // 4. Direct insert into waiter_calls (single fast roundtrip)
    const { data: insertedCall, error: insErr } = await supabaseAdmin
      .from('waiter_calls')
      .insert({
        session_id: session.id,
        table_id: session.table_id,
        table_number: tableNumber,
        note,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Error inserting waiter call:', insErr);
      return NextResponse.json(
        { success: false, message: 'Could not alert staff. Please wave down a server.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      call_id: insertedCall?.id,
      ...(refreshedSession ? { refreshed_session: refreshedSession } : {}),
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
