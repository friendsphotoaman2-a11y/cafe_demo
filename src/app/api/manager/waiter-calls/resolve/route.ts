import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { call_id } = await req.json();

    if (!call_id) {
      return NextResponse.json({ success: false, message: 'call_id is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('waiter_calls')
      .update({ status: 'RESOLVED' })
      .eq('id', call_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, call: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
