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

    // Lookup strictly from Google Sheets Customers tab
    const sheetResult = await lookupCustomerPhoneInSheet(cleanPhone, customSheetId);
    const previousVisits = sheetResult.found ? sheetResult.previousVisits : 0;
    const customerName = sheetResult.found ? sheetResult.name || '' : '';

    const isFreeVisit = previousVisits > 0 && previousVisits % loyaltyN === 0;
    const newCount = previousVisits + 1;
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
      source: 'google_sheets',
    });
  } catch (err: unknown) {
    console.error('Error in loyalty lookup:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}
