import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_token = body.session_token || body.sessionToken;
    const session_id = body.session_id || body.sessionId;
    const device_id = body.device_id || body.deviceId || 'dev_client';
    const notes = body.notes || null;
    const items = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cart is empty. Please add items before placing order.' },
        { status: 400 }
      );
    }

    if (!session_token && !session_id) {
      return NextResponse.json(
        { success: false, message: 'Session is closed or invalid. Please refresh or ask manager.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 0. Defensive Check: Verify that the session is strictly ACTIVE (Vector 3: Order with closed session prevention)
    let sessionRecord: { id: string; status: string; locked_until: string | null } | null = null;
    if (session_id) {
      const { data } = await supabaseAdmin
        .from('table_sessions')
        .select('id, status, locked_until')
        .eq('id', session_id)
        .maybeSingle();
      sessionRecord = data;
    } else if (session_token) {
      const { data } = await supabaseAdmin
        .from('table_sessions')
        .select('id, status, locked_until')
        .or(`session_token.eq.${session_token},id.eq.${session_token}`)
        .maybeSingle();
      sessionRecord = data;
    }

    if (!sessionRecord || sessionRecord.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: 'SESSION_CLOSED',
          message: 'This table session has ended or is not active. Please ask the manager or scan the table QR code.',
        },
        { status: 403 }
      );
    }

    // STRICT: Sanitize payload to guarantee client NEVER sends prices
    const sanitizedItems = items.map((it: { item_id: string; quantity: number; notes?: string }) => ({
      item_id: String(it.item_id),
      quantity: Math.max(1, parseInt(String(it.quantity || 1), 10)),
      notes: it.notes ? String(it.notes).trim().slice(0, 150) : null,
    }));

    let rpcData: Record<string, unknown> | null = null;
    let rpcError: { message?: string } | null = null;

    // Call place_table_order RPC directly (server-verified DB prices & availability)
    const { data: ptoData, error: ptoErr } = await supabaseAdmin.rpc('place_table_order', {
      p_session_token: session_token || session_id,
      p_device_id: device_id,
      p_notes: notes,
      p_items: sanitizedItems,
    });

    if (!ptoErr && ptoData) {
      rpcData = ptoData as Record<string, unknown>;
    } else if (ptoErr) {
      rpcError = ptoErr;
    }

    if (rpcError && !rpcData) {
      console.error('Error placing table order:', rpcError);
      return NextResponse.json(
        {
          success: false,
          message: rpcError.message || 'Failed to place order. An item may be unavailable or session closed.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(rpcData || { success: true });
  } catch (err: unknown) {
    console.error('Order API error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error while placing order.' },
      { status: 500 }
    );
  }
}
