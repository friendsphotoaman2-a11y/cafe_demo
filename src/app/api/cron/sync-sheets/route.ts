import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBillToGoogleSheets } from '@/lib/google-sheets';
import { Bill, OrderItem } from '@/types/database';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    // 1. Fetch manager settings for Google Sheet ID
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();

    const customSheetId = settingsRow?.google_sheet_id || null;

    // 2. Find any unsynced bills
    const { data: unsyncedBills, error: billsErr } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('synced_to_sheets', false)
      .order('created_at', { ascending: true })
      .limit(20);

    if (billsErr) {
      return NextResponse.json({ success: false, message: billsErr.message }, { status: 500 });
    }

    let syncedCount = 0;

    if (unsyncedBills && unsyncedBills.length > 0) {
      for (const b of unsyncedBills) {
        const bill = b as Bill;

        // Fetch items for this bill from orders
        const items: OrderItem[] = [];
        if (bill.session_id) {
          const { data: orderData } = await supabaseAdmin
            .from('orders')
            .select('id, order_items(*)')
            .eq('session_id', bill.session_id);

          if (orderData) {
            for (const ord of orderData) {
              if (ord.order_items && Array.isArray(ord.order_items)) {
                items.push(...(ord.order_items as OrderItem[]));
              }
            }
          }
        }

        const syncRes = await syncBillToGoogleSheets(
          bill,
          items.filter(it => it.status !== 'CANCELLED'),
          customSheetId
        );

        if (syncRes.success) {
          await supabaseAdmin
            .from('bills')
            .update({
              synced_to_sheets: true,
              sheets_synced_at: new Date().toISOString(),
            })
            .eq('id', bill.id);
          syncedCount++;
        }
      }
    }

    // 3. Keep Supabase light: Clean up closed sessions and settled orders older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Find closed sessions older than 7 days
    const { data: oldSessions } = await supabaseAdmin
      .from('table_sessions')
      .select('id')
      .eq('status', 'CLOSED')
      .lt('closed_at', sevenDaysAgo)
      .limit(50);

    let purgedSessionsCount = 0;
    if (oldSessions && oldSessions.length > 0) {
      const oldSessionIds = oldSessions.map(s => s.id);
      
      // Delete orders associated with old closed sessions
      await supabaseAdmin
        .from('orders')
        .delete()
        .in('session_id', oldSessionIds);

      // Delete the old closed sessions
      const { error: sessionDelErr } = await supabaseAdmin
        .from('table_sessions')
        .delete()
        .in('id', oldSessionIds);

      if (!sessionDelErr) {
        purgedSessionsCount = oldSessionIds.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync routine complete. Synced ${syncedCount} bills. Purged ${purgedSessionsCount} old closed sessions (>7d).`,
      synced_bills: syncedCount,
      purged_sessions: purgedSessionsCount,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
