import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = (searchParams.get('sessionId') || searchParams.get('session_id') || '').trim();
    const sessionToken = (searchParams.get('sessionToken') || searchParams.get('session_token') || '').trim();

    if (!sessionId || !sessionToken) {
      return NextResponse.json(
        { success: false, message: 'sessionId and sessionToken are required.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Fetch session auth and orders in parallel to cut latency in half
    const [
      { data: session, error: sessErr },
      { data: orders, error },
    ] = await Promise.all([
      supabaseAdmin
        .from('table_sessions')
        .select('id, status, session_token')
        .eq('id', sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
    ]);

    if (sessErr || !session) {
      return NextResponse.json(
        { success: false, message: 'Session not found.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (String(session.session_token) !== sessionToken) {
      return NextResponse.json(
        { success: false, message: 'Access denied to this table session.' },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, session_status: session.status, orders: orders || [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
