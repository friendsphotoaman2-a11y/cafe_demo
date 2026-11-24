import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBillToGoogleSheets } from '@/lib/google-sheets';
import { Bill, OrderItem } from '@/types/database';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const {
      session_id,
      customer_name,
      customer_phone,
      payment_mode = 'cash',
      discount = 0,
      free_coffee_item_id,
    } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { success: false, message: 'Session ID is required.' },
        { status: 400 }
      );
    }

    const cleanName = (customer_name || 'Guest').trim();
    const cleanPhone = normalizePhoneNumber(customer_phone || '');

    // Validate 10 digits if a phone number was entered
    if (cleanPhone && cleanPhone.length !== 10) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid phone number. Please enter a valid 10-digit mobile number.',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch manager settings to get order ID prefix and tax configuration
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    let prefix = 'CF-';
    let taxEnabled = true;
    const taxRate = Number(settingsRow?.gst_rate_percent) || 5.0;

    if (settingsRow?.cafe_tagline) {
      try {
        if (settingsRow.cafe_tagline.trim().startsWith('{')) {
          const meta = JSON.parse(settingsRow.cafe_tagline);
          if (meta.order_id_prefix) prefix = meta.order_id_prefix.trim();
          if (meta.tax_enabled !== undefined) taxEnabled = Boolean(meta.tax_enabled);
        }
      } catch {
        // Fallback
      }
    }
    if (!prefix.endsWith('-')) prefix += '-';

    // 2. Generate Unique Order ID like CF-261124-0012
    // Format: [PREFIX][DDMMYY]-[DAILY_COUNTER_4_DIGITS]
    const now = new Date();
    const istOptions = { timeZone: 'Asia/Kolkata' };
    const day = String(now.toLocaleDateString('en-GB', { day: '2-digit', ...istOptions }));
    const month = String(now.toLocaleDateString('en-GB', { month: '2-digit', ...istOptions }));
    const year = String(now.toLocaleDateString('en-GB', { year: '2-digit', ...istOptions }));
    const dateStr = `${day}${month}${year}`;

    // Get count of bills created today in IST for the 4-digit daily sequence counter
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { count: todayBillsCount } = await supabaseAdmin
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfToday.toISOString());

    const dailyCounter = String((todayBillsCount || 0) + 1).padStart(4, '0');
    const uniqueOrderId = `${prefix}${dateStr}-${dailyCounter}`;

    // 3. Fetch order items for this session before closing it
    const { data: orderRecords } = await supabaseAdmin
      .from('orders')
      .select('id, order_items(*)')
      .eq('session_id', session_id);

    const orderItems: OrderItem[] = [];
    if (orderRecords) {
      for (const order of orderRecords) {
        if (order.order_items && Array.isArray(order.order_items)) {
          orderItems.push(...(order.order_items as OrderItem[]));
        }
      }
    }

    // Filter non-cancelled items for billing
    const nonCancelledItems = orderItems.filter(it => it.status !== 'CANCELLED');

    // Calculate free coffee waiver if manager picked a coffee item
    let baseDiscount = Number(discount) || 0;
    let isFreeCoffeeAwarded = false;
    if (free_coffee_item_id) {
      const freeItem = nonCancelledItems.find(it => it.id === free_coffee_item_id);
      if (freeItem) {
        const itemUnitPrice = Number(freeItem.price_per_unit) || 0;
        baseDiscount += itemUnitPrice;
        isFreeCoffeeAwarded = true;
      }
    }

    // 4. Try executing save_bill RPC function (in one database transaction)
    let billId: string | null = null;
    let finalBillRow: Bill | null = null;

    const { data: saveBillData, error: saveBillErr } = await supabaseAdmin.rpc('save_bill', {
      p_session_id: session_id,
      p_customer_name: cleanName,
      p_customer_phone: cleanPhone || 'N/A',
      p_payment_mode: payment_mode,
      p_discount: baseDiscount,
      p_custom_order_id: uniqueOrderId,
    });

    if (!saveBillErr && saveBillData?.bill_id) {
      billId = saveBillData.bill_id;
    } else {
      // Fallback: If save_bill RPC not yet run in Postgres, execute transaction steps safely:
      // A. Verify session
      const { data: sessionRow, error: sessionErr } = await supabaseAdmin
        .from('table_sessions')
        .select('*, cafe_tables(*)')
        .eq('id', session_id)
        .single();

      if (sessionErr || !sessionRow) {
        return NextResponse.json(
          { success: false, message: 'Active session not found.' },
          { status: 404 }
        );
      }

      // B. Compute subtotal
      const subtotal = nonCancelledItems.reduce(
        (sum, item) => sum + item.price_per_unit * item.quantity,
        0
      );
      const effectiveTaxRate = taxEnabled ? taxRate : 0;
      const taxableAmount = Math.max(0, subtotal - baseDiscount);
      const gstAmount = Math.round(((taxableAmount * effectiveTaxRate) / 100) * 100) / 100;
      const totalAmount = taxableAmount + gstAmount;

      // C. Customer Loyalty computation
      let visitCount = 1;
      let isLoyaltyFreeCoffee = false;

      if (cleanPhone && cleanPhone.length === 10) {
        const { data: customerRow } = await supabaseAdmin
          .from('customers')
          .select('*')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (customerRow) {
          visitCount = customerRow.total_visits + 1;
          // Every 5 visits rule (free coffee on visits 6, 11, 16...)
          if ((visitCount - 1) % 5 === 0 && visitCount > 1) {
            isLoyaltyFreeCoffee = true;
          }

          await supabaseAdmin
            .from('customers')
            .update({
              name: cleanName,
              total_visits: visitCount,
              free_coffee_awarded:
                customerRow.free_coffee_awarded + (isLoyaltyFreeCoffee ? 1 : 0),
              last_visit_at: new Date().toISOString(),
            })
            .eq('id', customerRow.id);
        } else {
          visitCount = 1;
          await supabaseAdmin.from('customers').insert({
            phone: cleanPhone,
            name: cleanName,
            total_visits: 1,
            free_coffee_awarded: 0,
            last_visit_at: new Date().toISOString(),
          });
        }
      }

      // D. Insert into bills with synced_to_sheets = false
      const { data: newBill, error: insertBillErr } = await supabaseAdmin
        .from('bills')
        .insert({
          invoice_number: uniqueOrderId,
          session_id: session_id,
          table_id: sessionRow.table_id,
          table_number: sessionRow.cafe_tables?.table_number || 'Table',
          customer_name: cleanName,
          customer_phone: cleanPhone || 'N/A',
          subtotal,
          discount: baseDiscount,
          gst_rate: effectiveTaxRate,
          gst_amount: gstAmount,
          total_amount: totalAmount,
          visit_count: visitCount,
          is_loyalty_free_coffee: isLoyaltyFreeCoffee || isFreeCoffeeAwarded,
          synced_to_sheets: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertBillErr || !newBill) {
        console.error('Error inserting bill:', insertBillErr);
        return NextResponse.json(
          { success: false, message: insertBillErr?.message || 'Failed to save bill record.' },
          { status: 500 }
        );
      }

      billId = newBill.id;
      finalBillRow = newBill as Bill;

      // E. Mark orders as BILLED and close the table session
      await supabaseAdmin
        .from('orders')
        .update({ status: 'BILLED' })
        .eq('session_id', session_id);

      await supabaseAdmin
        .from('table_sessions')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .eq('id', session_id);
    }

    // 5. Fetch full bill record if not already in memory
    if (!finalBillRow && billId) {
      const { data: fetchedBill } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('id', billId)
        .single();
      finalBillRow = fetchedBill as Bill;
    }

    if (!finalBillRow) {
      return NextResponse.json(
        { success: false, message: 'Bill processed but could not retrieve invoice.' },
        { status: 500 }
      );
    }

    // 6. Sync to Google Sheets
    let sheetsSyncSuccess = false;
    try {
      const sheetId = settingsRow?.google_sheet_id || process.env.GOOGLE_SHEET_ID;
      const syncResult = await syncBillToGoogleSheets(
        finalBillRow,
        nonCancelledItems,
        sheetId,
        payment_mode,
        free_coffee_item_id
      );
      sheetsSyncSuccess = syncResult.success;

      if (sheetsSyncSuccess) {
        await supabaseAdmin
          .from('bills')
          .update({ synced_to_sheets: true, sheets_synced_at: new Date().toISOString() })
          .eq('id', finalBillRow.id);
      }
    } catch (sheetErr) {
      console.warn('Google Sheets sync warning:', sheetErr);
    }

    return NextResponse.json({
      success: true,
      order_id: finalBillRow.invoice_number,
      bill: finalBillRow,
      items: nonCancelledItems,
      payment_mode,
      sheets_synced: sheetsSyncSuccess,
    });
  } catch (err: unknown) {
    console.error('Billing error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal billing error.' },
      { status: 500 }
    );
  }
}
