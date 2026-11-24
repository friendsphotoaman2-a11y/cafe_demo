import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Scheduled Cron Function: Resets all menu items to is_available = true
 * Scheduled to run daily at 5:00 AM Asia/Kolkata (23:30 UTC).
 * Can also be triggered manually by the manager from the Menu tab.
 */
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update({ is_available: true })
      .neq('is_available', true)
      .select('id');

    if (error) {
      console.error('Error resetting menu availability:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const resetCount = data ? data.length : 0;

    if (resetCount > 0) {
      try {
        await recordAuditLog({
          action: 'AVAILABILITY_CHANGED',
          actor_email: 'system.cron@cafe.com',
          entity_type: 'menu_items',
          entity_id: 'bulk_reset',
          title: `Daily 5:00 AM Reset: ${resetCount} items restored to Available`,
          details: {
            reset_count: resetCount,
            triggered_by: '5_AM_auto_cron',
          },
        });
      } catch (auditErr) {
        console.warn('Cron audit log error:', auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Daily 5:00 AM IST reset complete. ${resetCount} unavailable items restored to available.`,
      reset_count: resetCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
