import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'sessionId is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Verify session exists
    const { data: session } = await supabaseAdmin
      .from('table_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Session not found.' },
        { status: 404 }
      );
    }

    // Fetch orders and items exclusively for this session
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, orders: orders || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
