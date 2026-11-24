import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ManagerSettings } from '@/types/database';
import { verifyManagerAuth } from '@/lib/auth-guard';

interface SettingsMeta {
  email?: string;
  tax_enabled?: boolean;
  session_hours?: number;
  loyalty_every_n_visits?: number;
  order_id_prefix?: string;
  require_pin?: boolean;
  table_pin_overrides?: Record<string, 'DEFAULT' | 'ON' | 'OFF'>;
}

function parseMeta(tagline: string | null | undefined): SettingsMeta {
  if (!tagline) return {};
  try {
    if (tagline.trim().startsWith('{')) {
      return JSON.parse(tagline);
    }
  } catch {
    // Ignore legacy plain text taglines
  }
  return {};
}

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, message: 'Settings not found' }, { status: 404 });
    }

    const meta = parseMeta(data.cafe_tagline);

    const mergedSettings: ManagerSettings = {
      ...data,
      cafe_email: data.cafe_email ?? meta.email ?? 'contact@brewandbites.com',
      tax_enabled: data.tax_enabled ?? meta.tax_enabled ?? true,
      session_hours: data.session_hours ?? meta.session_hours ?? 2,
      loyalty_every_n_visits: data.loyalty_every_n_visits ?? meta.loyalty_every_n_visits ?? 5,
      order_id_prefix: data.order_id_prefix ?? meta.order_id_prefix ?? 'ORD-',
      require_pin: (data as Record<string, unknown>).require_pin !== undefined 
        ? Boolean((data as Record<string, unknown>).require_pin) 
        : (meta.require_pin ?? true),
      table_pin_overrides: meta.table_pin_overrides || {},
    };

    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const body = await req.json();
    const supabase = createAdminClient();

    // Fetch existing settings to check for changes
    const { data: existingData } = await supabase
      .from('manager_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const existingMeta = parseMeta(existingData?.cafe_tagline);
    const prevRequirePin = (existingData as Record<string, unknown>)?.require_pin !== undefined
      ? Boolean((existingData as Record<string, unknown>).require_pin)
      : (existingMeta.require_pin ?? true);

    const newRequirePin = body.require_pin !== undefined ? Boolean(body.require_pin) : prevRequirePin;
    const newOverrides = body.table_pin_overrides !== undefined ? body.table_pin_overrides : (existingMeta.table_pin_overrides || {});

    const meta: SettingsMeta = {
      email: body.cafe_email || existingMeta.email || '',
      tax_enabled: body.tax_enabled !== undefined ? body.tax_enabled : (existingMeta.tax_enabled ?? true),
      session_hours: Number(body.session_hours) || existingMeta.session_hours || 2,
      loyalty_every_n_visits: Number(body.loyalty_every_n_visits) || existingMeta.loyalty_every_n_visits || 5,
      order_id_prefix: (body.order_id_prefix || existingMeta.order_id_prefix || 'ORD-').trim(),
      require_pin: newRequirePin,
      table_pin_overrides: newOverrides,
    };

    const updatePayload: Record<string, unknown> = {
      cafe_name: body.cafe_name || existingData?.cafe_name || 'Brew & Bites Cafe',
      cafe_address: body.cafe_address !== undefined ? body.cafe_address : existingData?.cafe_address,
      cafe_phone: body.cafe_phone !== undefined ? body.cafe_phone : existingData?.cafe_phone,
      gst_number: body.gst_number !== undefined ? body.gst_number : existingData?.gst_number,
      receipt_paper_size: body.receipt_paper_size === '58mm' ? '58mm' : '80mm',
      gst_rate_percent: Number(body.gst_rate_percent) || 0,
      kitchen_screen_enabled: Boolean(body.kitchen_screen_enabled),
      google_sheet_id: body.google_sheet_id !== undefined ? body.google_sheet_id : existingData?.google_sheet_id,
      cafe_tagline: JSON.stringify(meta),
      updated_at: new Date().toISOString(),
    };

    // If require_pin column exists in database schema, update it too
    if ((existingData as Record<string, unknown>)?.require_pin !== undefined) {
      updatePayload.require_pin = newRequirePin;
    }

    const { data, error } = await supabase
      .from('manager_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Audit log if require_pin or table overrides changed
    if (prevRequirePin !== newRequirePin || JSON.stringify(existingMeta.table_pin_overrides) !== JSON.stringify(newOverrides)) {
      try {
        await supabase.from('audit_log').insert({
          action: 'PIN_SETTING_CHANGED',
          actor_email: auth.email || 'manager',
          entity_type: 'SETTINGS',
          entity_id: 'manager_settings',
          details: {
            previous_require_pin: prevRequirePin,
            new_require_pin: newRequirePin,
            table_pin_overrides: newOverrides,
          },
        });
      } catch (auditErr) {
        console.warn('Could not write audit log for PIN change:', auditErr);
      }
    }

    const mergedSettings: ManagerSettings = {
      ...data,
      cafe_email: meta.email,
      tax_enabled: meta.tax_enabled,
      session_hours: meta.session_hours,
      loyalty_every_n_visits: meta.loyalty_every_n_visits,
      order_id_prefix: meta.order_id_prefix,
      require_pin: newRequirePin,
      table_pin_overrides: newOverrides,
    };

    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
