import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { table_id } = await req.json();

    if (!table_id) {
      return NextResponse.json(
        { success: false, message: 'Table ID is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    let sessionResult: Record<string, unknown> | null = null;

    // 1. Try generate_table_pin RPC
    try {
      const { data: rpcPin, error: rpcErr } = await supabaseAdmin.rpc('generate_table_pin', {
        p_table_id: table_id,
      });
      if (!rpcErr && rpcPin) {
        sessionResult = rpcPin as Record<string, unknown>;
      }
    } catch {
      // Continue to generate_table_session
    }

    if (!sessionResult) {
      // 2. Try generate_table_session RPC
      const { data, error } = await supabaseAdmin.rpc('generate_table_session', {
        p_table_id: table_id,
      });

      if (error) {
        console.error('Error generating table session:', error);
        return NextResponse.json(
          { success: false, message: error.message || 'Could not generate table session' },
          { status: 500 }
        );
      }
      sessionResult = data as Record<string, unknown>;
    }

    // Log to Audit Log
    try {
      const { data: tbl } = await supabaseAdmin
        .from('cafe_tables')
        .select('table_number')
        .eq('id', table_id)
        .maybeSingle();

      const tableNum = tbl?.table_number || `Table (${table_id})`;
      const pinCode = (sessionResult?.pin_code || sessionResult?.pin || '') as string;

      await recordAuditLog({
        action: 'PIN_GENERATED',
        entity_type: 'table_sessions',
        entity_id: (sessionResult?.id as string) || table_id,
        title: `PIN generated for ${tableNum} (PIN: ${pinCode})`,
        details: {
          table_id,
          table_number: tableNum,
          pin_code: pinCode,
          session_id: sessionResult?.id,
        },
      });
    } catch (auditErr) {
      console.warn('PIN_GENERATED audit log error:', auditErr);
    }

    return NextResponse.json({ success: true, session: sessionResult });
  } catch (err: unknown) {
    console.error('generate session API error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
