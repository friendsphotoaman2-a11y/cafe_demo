import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Can be triggered by Vercel Cron or Supabase pg_cron daily to keep Supabase light
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let legacyBillsCleaned = 0;
    try {
      const { data } = await supabaseAdmin.rpc('cleanup_old_closed_bills');
      legacyBillsCleaned = Number(data) || 0;
    } catch {
      // Optional if RPC/bills table removed
    }

    await supabaseAdmin
      .from('waiter_calls')
      .delete()
      .eq('status', 'RESOLVED')
      .lt('created_at', sevenDaysAgo);

    const { data: oldSessions } = await supabaseAdmin
      .from('table_sessions')
      .select('id')
      .eq('status', 'CLOSED')
      .lt('closed_at', sevenDaysAgo)
      .limit(100);

    let purgedSessions = 0;
    if (oldSessions && oldSessions.length > 0) {
      const ids = oldSessions.map(s => s.id);
      await supabaseAdmin.from('orders').delete().in('session_id', ids);
      const { error: delErr } = await supabaseAdmin.from('table_sessions').delete().in('id', ids);
      if (!delErr) purgedSessions = ids.length;
    }

    return NextResponse.json({
      success: true,
      message: `Supabase light cleanup complete: purged ${purgedSessions} old closed sessions (>7d) and ${legacyBillsCleaned} legacy bills.`,
      deleted_count: purgedSessions + legacyBillsCleaned,
      purged_sessions: purgedSessions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
