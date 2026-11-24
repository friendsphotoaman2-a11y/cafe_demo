import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { order_item_id, order_id, status } = await req.json();

    const supabaseAdmin = createAdminClient();

    if (order_item_id) {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .update({ status })
        .eq('id', order_item_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, item: data });
    }

    if (order_id) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', order_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, order: data });
    }

    return NextResponse.json(
      { success: false, message: 'order_item_id or order_id required' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
