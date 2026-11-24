import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { item_id, is_available } = await req.json();

    if (!item_id || typeof is_available !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'item_id and is_available boolean are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update({ is_available })
      .eq('id', item_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Record Audit Log
    try {
      const itemName = data?.name_en || item_id;
      await recordAuditLog({
        action: 'AVAILABILITY_CHANGED',
        entity_type: 'menu_items',
        entity_id: item_id,
        title: `${itemName} marked ${is_available ? 'Available' : 'Unavailable Today'}`,
        details: {
          item_id,
          name_en: data?.name_en,
          name_hi: data?.name_hi,
          is_available,
        },
      });
    } catch (auditErr) {
      console.warn('AVAILABILITY_CHANGED audit log error:', auditErr);
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
