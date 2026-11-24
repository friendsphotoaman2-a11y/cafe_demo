import { NextRequest, NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { session_id, table_id } = await req.json();

    if (!session_id && !table_id) {
      return NextResponse.json(
        { success: false, message: 'session_id or table_id is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Try regenerate_pin RPC if it exists
    if (session_id) {
      try {
        const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('regenerate_pin', {
          p_session_id: session_id,
        });
        if (!rpcErr && rpcData) {
          const rpcObj = rpcData as Record<string, unknown>;
          const rpcPin = (rpcObj?.pin_code || rpcObj?.pin || '') as string;
          const actorEmail = auth.email || 'manager@cafe.com';
          after(async () => {
            await recordAuditLog({
              action: 'PIN_GENERATED',
              actor_email: actorEmail,
              entity_type: 'table_sessions',
              entity_id: (rpcObj?.id as string) || session_id,
              title: `PIN regenerated${rpcPin ? ` (New PIN: ${rpcPin})` : ''}`,
              details: {
                table_id: (rpcObj?.table_id as string) || table_id,
                pin_code: rpcPin,
                session_id: (rpcObj?.id as string) || session_id,
                regenerated: true,
              },
            }).catch(auditErr => console.warn('PIN regenerated audit log error:', auditErr));
          });
          return NextResponse.json({ success: true, session: rpcData });
        }
      } catch {
        // Fallback to direct update
      }
    }

    // 2. Generate random 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    let query = supabaseAdmin
      .from('table_sessions')
      .update({
        pin_code: newPin,
        failed_attempts: 0,
        locked_until: null,
      });

    if (session_id) {
      query = query.eq('id', session_id);
    } else if (table_id) {
      query = query.eq('table_id', table_id).eq('status', 'ACTIVE');
    }

    const { data, error } = await query.select('*').maybeSingle();

    if (error) {
      console.error('Error regenerating PIN:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Could not regenerate PIN' },
        { status: 500 }
      );
    }

    // Log PIN regeneration cleanly after response
    const actorEmail = auth.email || 'manager@cafe.com';
    after(async () => {
      await recordAuditLog({
        action: 'PIN_GENERATED',
        actor_email: actorEmail,
        entity_type: 'table_sessions',
        entity_id: data?.id || session_id || table_id,
        title: `PIN regenerated (New PIN: ${newPin})`,
        details: {
          table_id: data?.table_id || table_id,
          pin_code: newPin,
          session_id: data?.id || session_id,
          regenerated: true,
        },
      }).catch(auditErr => {
        console.warn('PIN regenerated audit log error:', auditErr);
      });
    });

    return NextResponse.json({ success: true, pin_code: newPin, session: data });
  } catch (err: unknown) {
    console.error('Regenerate PIN API error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
