import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { item_id, reason = 'Manager cancelled item', manager_email = 'manager' } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, message: 'item_id is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch item to get order and dish info
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from('order_items')
      .select('*, orders(id, table_id)')
      .eq('id', item_id)
      .maybeSingle();

    if (fetchErr || !item) {
      return NextResponse.json(
        { success: false, message: 'Order item not found.' },
        { status: 404 }
      );
    }

    // 2. Mark item as CANCELLED
    const { error: updateErr } = await supabaseAdmin
      .from('order_items')
      .update({ status: 'CANCELLED' })
      .eq('id', item_id);

    if (updateErr) {
      console.error('Error cancelling order item:', updateErr);
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    // Check if any active items remain in this order
    const { data: remainingItems } = await supabaseAdmin
      .from('order_items')
      .select('id, status')
      .eq('order_id', item.order_id);

    const hasActiveItems = remainingItems?.some(it => it.status !== 'CANCELLED');
    if (!hasActiveItems) {
      // Mark entire order as CANCELLED so it is removed from active boards
      await supabaseAdmin
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', item.order_id);
    }

    // 3. Write to audit log (Local + Google Sheet + Supabase)
    try {
      await recordAuditLog({
        action: 'ORDER_CANCELLED',
        actor_email: manager_email,
        entity_type: 'order_items',
        entity_id: item_id,
        title: `Cancelled ${item.quantity}x ${item.item_name_en} (₹${item.price_per_unit * item.quantity}) - ${reason}`,
        details: {
          order_id: item.order_id,
          table_id: item.orders?.table_id,
          item_name_en: item.item_name_en,
          item_name_hi: item.item_name_hi,
          price_per_unit: item.price_per_unit,
          quantity: item.quantity,
          total_refund_amount: item.price_per_unit * item.quantity,
          reason: reason,
          cancelled_at: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn('ORDER_CANCELLED audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Item cancelled successfully and logged to audit log.',
      item_id,
    });
  } catch (err: unknown) {
    console.error('Cancel order item error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
