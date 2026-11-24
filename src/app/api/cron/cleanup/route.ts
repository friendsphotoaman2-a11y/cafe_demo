import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Can be triggered by Vercel Cron or Supabase pg_cron daily
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.rpc('cleanup_old_closed_bills');

    if (error) {
      console.error('Error cleaning up old closed bills:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${data || 0} old closed bills (>30 days).`,
      deleted_count: data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
