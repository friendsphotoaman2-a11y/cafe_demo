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

    // Check effective PIN requirement for this table
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    let masterRequirePin = true;
    let tableOverrides: Record<string, 'DEFAULT' | 'ON' | 'OFF'> = {};

    if (settingsRow) {
      if ((settingsRow as Record<string, unknown>).require_pin !== undefined) {
        masterRequirePin = Boolean((settingsRow as Record<string, unknown>).require_pin);
      }
      try {
        if (settingsRow.cafe_tagline && settingsRow.cafe_tagline.startsWith('{')) {
          const parsed = JSON.parse(settingsRow.cafe_tagline);
          if (parsed.require_pin !== undefined) masterRequirePin = Boolean(parsed.require_pin);
          if (parsed.table_pin_overrides) tableOverrides = parsed.table_pin_overrides;
        }
      } catch {
        // Fallback to default
      }
    }

    const tableOverride = tableOverrides[table.id] || (table as Record<string, unknown>).pin_override || 'DEFAULT';
    let effectiveRequirePin = masterRequirePin;
    if (tableOverride === 'ON') effectiveRequirePin = true;
    if (tableOverride === 'OFF') effectiveRequirePin = false;

    // If validating a saved session for auto-login
    if (sessionId || sessionToken) {
      let query = supabaseAdmin
        .from('table_sessions')
        .select('id, session_token, status, locked_until')
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
          require_pin: effectiveRequirePin,
          session_id: activeSession.id,
          session_token: activeSession.session_token,
          table_number: table.table_number,
          table_id: table.id,
        });
      }

      // If saved session is invalid but PIN is OFF, fall through to auto-create/join below
      if (effectiveRequirePin) {
        return NextResponse.json({
          success: true,
          active: false,
          require_pin: true,
          message: 'Session has ended or is invalid.',
        });
      }
    }

    // -------------------------------------------------------------------------
    // PIN OFF MODE: Automatically join or create ONE active session for this table
    // -------------------------------------------------------------------------
    if (!effectiveRequirePin) {
      // Find existing active session for this table
      const { data: existingSession } = await supabaseAdmin
        .from('table_sessions')
        .select('id, session_token, status, locked_until')
        .eq('table_id', table.id)
        .eq('status', 'ACTIVE')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession && existingSession.status === 'ACTIVE') {
        return NextResponse.json({
          success: true,
          active: true,
          require_pin: false,
          session_id: existingSession.id,
          session_token: existingSession.session_token,
          table_number: table.table_number,
          table_id: table.id,
        });
      }

      // Create new session without PIN
      const newToken = 'np_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const { data: newSession, error: createErr } = await supabaseAdmin
        .from('table_sessions')
        .insert({
          table_id: table.id,
          pin_code: '0000',
          session_token: newToken,
          status: 'ACTIVE',
          opened_at: new Date().toISOString(),
        })
        .select('id, session_token')
        .single();

      if (!createErr && newSession) {
        return NextResponse.json({
          success: true,
          active: true,
          require_pin: false,
          session_id: newSession.id,
          session_token: newSession.session_token,
          table_number: table.table_number,
          table_id: table.id,
        });
      }
    }

    // -------------------------------------------------------------------------
    // PIN ON MODE: Generic status check (manager must generate PIN)
    // -------------------------------------------------------------------------
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
      require_pin: true,
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
