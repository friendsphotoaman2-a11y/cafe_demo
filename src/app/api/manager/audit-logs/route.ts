import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, removeAuditLogs } from '@/lib/audit-logger';
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
    const forceRefresh = searchParams.get('refresh') === 'true';

    const allLogs = await getAuditLogs({ action: 'ALL', dateFilter: 'all', forceRefresh });
    const filteredLogs = await getAuditLogs({ action, dateFilter, limit, forceRefresh: false });

    const supabaseAdmin = createAdminClient();
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const googleSheetId =
      settingsRow?.google_sheet_id ||
      process.env.GOOGLE_SHEET_ID ||
      '1lqe2AlMhSUuXPcVIUBryfBUiL-us8r_5DzPDTwcCMUY';

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

export async function DELETE(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    let timestamp = (searchParams.get('timestamp') || '').trim();
    let entityId = (searchParams.get('entityId') || '').trim();
    let clearAll = searchParams.get('clearAll') === 'true';

    if (!timestamp && !clearAll) {
      try {
        const body = await req.json();
        timestamp = (body.timestamp || '').trim();
        entityId = (body.entity_id || '').trim();
        clearAll = Boolean(body.clearAll);
      } catch {
        // No body
      }
    }

    if (!timestamp && !clearAll) {
      return NextResponse.json(
        { success: false, message: 'Provide timestamp or clearAll=true.' },
        { status: 400 }
      );
    }

    const res = await removeAuditLogs({ timestamp, entity_id: entityId, clearAll });
    if (!res.success) {
      return NextResponse.json(
        { success: false, message: res.error || 'Failed to delete from Google Sheet AuditLog.' },
        { status: 500 }
      );
    }

    // Clean up any legacy Supabase audit_logs/audit_log rows if present
    try {
      const supabaseAdmin = createAdminClient();
      if (clearAll) {
        await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } else if (entityId) {
        await supabaseAdmin.from('audit_logs').delete().eq('entity_id', entityId);
        await supabaseAdmin.from('audit_log').delete().eq('entity_id', entityId);
      }
    } catch {
      // Ignore if legacy tables do not exist
    }

    return NextResponse.json({
      success: true,
      deletedCount: res.deletedCount,
      message: clearAll
        ? `Cleared ${res.deletedCount} audit logs from Google Sheet.`
        : 'Audit log entry deleted from Google Sheet.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
