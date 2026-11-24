import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { session_id, table_id } = await req.json();

    if (!session_id && !table_id) {
      return NextResponse.json(
        { success: false, message: 'Session ID or Table ID is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Try close_session RPC
    if (session_id) {
      try {
        const { error: err1 } = await supabaseAdmin.rpc('close_session', {
          p_session_id: session_id,
        });
        if (!err1) {
          return NextResponse.json({ success: true });
        }
      } catch {
        // Continue
      }
    }

    // 2. Try close_table_session RPC
    if (session_id) {
      try {
        const { error: err2 } = await supabaseAdmin.rpc('close_table_session', {
          p_session_id: session_id,
        });
        if (!err2) {
          return NextResponse.json({ success: true });
        }
      } catch {
        // Continue
      }
    }

    // 3. Direct database update fallback
    let query = supabaseAdmin
      .from('table_sessions')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      });

    if (session_id) {
      query = query.eq('id', session_id);
    } else if (table_id) {
      query = query.eq('table_id', table_id).eq('status', 'ACTIVE');
    }

    const { error: updateErr } = await query;
    if (updateErr) {
      console.error('Error closing session:', updateErr);
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
