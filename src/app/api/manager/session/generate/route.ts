import { NextRequest, NextResponse, after } from 'next/server';
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

    // Call generate_table_session RPC directly for sub-millisecond generation
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

    const sessionResult = data as Record<string, unknown>;
    const tableNum = (sessionResult?.table_number as string) || `Table (${table_id})`;
    const pinCode = (sessionResult?.pin_code || sessionResult?.pin || '') as string;

    // Log to Google Sheets AuditLog safely after returning HTTP response
    after(async () => {
      await recordAuditLog({
        action: 'PIN_GENERATED',
        actor_email: auth.email || 'manager@cafe.com',
        entity_type: 'table_sessions',
        entity_id: (sessionResult?.session_id as string) || (sessionResult?.id as string) || table_id,
        title: `PIN generated for ${tableNum} (PIN: ${pinCode})`,
        details: {
          table_id,
          table_number: tableNum,
          pin_code: pinCode,
          session_id: sessionResult?.session_id || sessionResult?.id,
        },
      }).catch(auditErr => {
        console.warn('PIN_GENERATED background audit log error:', auditErr);
      });
    });

    return NextResponse.json({ success: true, session: sessionResult });
  } catch (err: unknown) {
    console.error('generate session API error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
