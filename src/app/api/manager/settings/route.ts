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

    const meta: SettingsMeta = {
      email: body.cafe_email || '',
      tax_enabled: body.tax_enabled ?? true,
      session_hours: Number(body.session_hours) || 2,
      loyalty_every_n_visits: Number(body.loyalty_every_n_visits) || 5,
      order_id_prefix: (body.order_id_prefix || 'ORD-').trim(),
    };

    const updatePayload: Record<string, unknown> = {
      cafe_name: body.cafe_name || 'Brew & Bites Cafe',
      cafe_address: body.cafe_address || '',
      cafe_phone: body.cafe_phone || '',
      gst_number: body.gst_number || '',
      receipt_paper_size: body.receipt_paper_size === '58mm' ? '58mm' : '80mm',
      gst_rate_percent: Number(body.gst_rate_percent) || 0,
      kitchen_screen_enabled: Boolean(body.kitchen_screen_enabled),
      google_sheet_id: body.google_sheet_id || null,
      cafe_tagline: JSON.stringify(meta),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('manager_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const mergedSettings: ManagerSettings = {
      ...data,
      cafe_email: meta.email,
      tax_enabled: meta.tax_enabled,
      session_hours: meta.session_hours,
      loyalty_every_n_visits: meta.loyalty_every_n_visits,
      order_id_prefix: meta.order_id_prefix,
    };

    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
