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

    // STRICT: Sanitize payload to guarantee client NEVER sends prices
    const sanitizedItems = items.map((it: { item_id: string; quantity: number; notes?: string }) => ({
      item_id: String(it.item_id),
      quantity: Math.max(1, parseInt(String(it.quantity || 1), 10)),
      notes: it.notes ? String(it.notes).trim().slice(0, 150) : null,
    }));

    // Resolve session_token if only session_id was supplied; otherwise call place_table_order directly in 1 DB hop
    let resolvedToken = session_token ? String(session_token).trim() : '';
    if (!resolvedToken && session_id) {
      const { data: sessRow } = await supabaseAdmin
        .from('table_sessions')
        .select('session_token, status')
        .eq('id', session_id)
        .maybeSingle();

      if (!sessRow || sessRow.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            success: false,
            error: 'SESSION_CLOSED',
            message: 'This table session has ended or is not active. Please ask the manager or scan the table QR code.',
          },
          { status: 403 }
        );
      }
      resolvedToken = String(sessRow.session_token);
    }

    const { data: ptoData, error: ptoErr } = await supabaseAdmin.rpc('place_table_order', {
      p_session_token: resolvedToken,
      p_device_id: device_id,
      p_notes: notes,
      p_items: sanitizedItems,
    });

    if (ptoErr || !ptoData) {
      console.error('Error placing table order:', ptoErr);
      return NextResponse.json(
        {
          success: false,
          message: ptoErr?.message || 'Failed to place order. An item may be unavailable or session closed.',
        },
        { status: 400 }
      );
    }

    const rpcData = ptoData as Record<string, unknown>;
    if (rpcData.success === false) {
      const msg = String(rpcData.message || '');
      const isClosed = msg.toLowerCase().includes('session') || msg.toLowerCase().includes('closed');
      return NextResponse.json(
        {
          success: false,
          ...(isClosed ? { error: 'SESSION_CLOSED' } : {}),
          message: msg || 'This table session has ended or is not active.',
        },
        { status: isClosed ? 403 : 400 }
      );
    }

    return NextResponse.json(rpcData);
  } catch (err: unknown) {
    console.error('Order API error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error while placing order.' },
      { status: 500 }
    );
  }
}
