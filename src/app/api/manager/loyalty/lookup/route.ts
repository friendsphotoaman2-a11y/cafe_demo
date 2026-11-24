import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupCustomerPhoneInSheet } from '@/lib/google-sheets';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { phone } = await req.json();
    const cleanPhone = normalizePhoneNumber(phone || '');

    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({
        success: false,
        valid: false,
        message: 'A valid 10-digit phone number is required.',
      });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch manager settings for loyalty threshold (default N = 5) and Google Sheet ID
    const { data: settingsRow } = await supabaseAdmin
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    let loyaltyN = 5;
    const customSheetId = settingsRow?.google_sheet_id || null;

    if (settingsRow?.cafe_tagline) {
      try {
        if (settingsRow.cafe_tagline.trim().startsWith('{')) {
          const meta = JSON.parse(settingsRow.cafe_tagline);
          if (meta.loyalty_every_n_visits) {
            loyaltyN = Number(meta.loyalty_every_n_visits) || 5;
          }
        }
      } catch {
        // Fallback
      }
    }

    // 2. Read ONLY the phone column in the Customers tab of the Google Sheet
    let previousVisits = 0;
    let customerName = '';
    let source = 'sheet';

    const sheetResult = await lookupCustomerPhoneInSheet(cleanPhone, customSheetId);

    if (sheetResult.found) {
      previousVisits = sheetResult.previousVisits;
      customerName = sheetResult.name || '';
    } else {
      // Fallback to Supabase customers table if not in Google Sheet yet
      source = 'database';
      const { data: dbCustomer } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (dbCustomer) {
        previousVisits = dbCustomer.total_visits || 0;
        customerName = dbCustomer.name || '';
      }
    }

    // 3. Rule: free visit when previous visits > 0 and previous visits % N == 0 (N = 5 from settings)
    const isFreeVisit = previousVisits > 0 && previousVisits % loyaltyN === 0;
    const newCount = previousVisits + 1;

    // Stamps collected: e.g. if previousVisits is 3, stamps is 3. If previousVisits is 5, stamps is 5 (full card!).
    const stampsEarned =
      previousVisits > 0 && previousVisits % loyaltyN === 0
        ? loyaltyN
        : previousVisits % loyaltyN;

    return NextResponse.json({
      success: true,
      valid: true,
      phone: cleanPhone,
      name: customerName,
      previous_visits: previousVisits,
      new_count: newCount,
      is_free_visit: isFreeVisit,
      loyalty_n: loyaltyN,
      stamps_earned: stampsEarned,
      stamps_total: loyaltyN,
      source,
    });
  } catch (err: unknown) {
    console.error('Error in loyalty lookup:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}
