import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit-logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'ALL';
    const dateFilter = searchParams.get('date') || 'all';
    const limit = Number(searchParams.get('limit')) || 200;

    // Fetch all logs to compute summary counts
    const allLogs = await getAuditLogs({ action: 'ALL', dateFilter: 'all' });

    // Fetch filtered logs
    const filteredLogs = await getAuditLogs({ action, dateFilter, limit });

    // Fetch Manager Settings for Google Sheet ID
    const supabaseAdmin = createAdminClient();
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const googleSheetId =
      settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID || '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY';

    const summary = {
      total_logs: allLogs.length,
      pin_generated_count: allLogs.filter(l => l.action === 'PIN_GENERATED').length,
      order_cancelled_count: allLogs.filter(l => l.action === 'ORDER_CANCELLED').length,
      availability_changed_count: allLogs.filter(l => l.action === 'AVAILABILITY_CHANGED').length,
      price_changed_count: allLogs.filter(l => l.action === 'PRICE_CHANGED').length,
    };

    return NextResponse.json({
      success: true,
      logs: filteredLogs,
      summary,
      google_sheet_id: googleSheetId,
      filters: { action, date: dateFilter },
    });
  } catch (err: unknown) {
    console.error('Audit Logs API error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
