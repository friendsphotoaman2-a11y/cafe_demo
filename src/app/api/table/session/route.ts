import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableCode = (searchParams.get('table_code') || '').trim().toUpperCase();
    const sessionId = searchParams.get('session_id') || '';
    const sessionToken = searchParams.get('session_token') || '';

    if (!tableCode) {
      return NextResponse.json({ success: false, message: 'table_code is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Find table
    const { data: table } = await supabaseAdmin
      .from('cafe_tables')
      .select('id, table_number, table_code')
      .ilike('table_code', tableCode)
      .maybeSingle();

    if (!table) {
      return NextResponse.json({ success: false, message: 'Table not found' }, { status: 404 });
    }

    // If validating a saved session for auto-login
    if (sessionId || sessionToken) {
      let query = supabaseAdmin
        .from('table_sessions')
        .select('id, status, locked_until')
        .eq('table_id', table.id)
        .eq('status', 'ACTIVE');

      if (sessionId) query = query.eq('id', sessionId);
      if (sessionToken) query = query.eq('session_token', sessionToken);

      const { data: activeSession } = await query.maybeSingle();

      if (activeSession && activeSession.status === 'ACTIVE') {
        const isLocked = Boolean(
          activeSession.locked_until && new Date(activeSession.locked_until) > new Date()
        );
        return NextResponse.json({
          success: true,
          active: !isLocked,
          session_id: activeSession.id,
          table_number: table.table_number,
          table_id: table.id,
        });
      }

      return NextResponse.json({
        success: true,
        active: false,
        message: 'Session has ended or is invalid.',
      });
    }

    // Generic status check: does table have an active session right now?
    const { data: currentSession } = await supabaseAdmin
      .from('table_sessions')
      .select('id, status, locked_until')
      .eq('table_id', table.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    const isLocked = Boolean(
      currentSession?.locked_until && new Date(currentSession.locked_until) > new Date()
    );

    return NextResponse.json({
      success: true,
      has_active_session: Boolean(currentSession && !isLocked),
      is_locked: isLocked,
      table_number: table.table_number,
      table_id: table.id,
    });
  } catch (err) {
    console.error('Table session check error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
