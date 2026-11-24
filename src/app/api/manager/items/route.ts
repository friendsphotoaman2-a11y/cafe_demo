import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit-logger';
import { verifyManagerAuth } from '@/lib/auth-guard';

// POST: Add new menu item
export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const body = await req.json();
    const {
      name_en,
      name_hi,
      description_en = '',
      description_hi = '',
      category_id,
      price,
      is_veg = true,
      image_url = null,
      meal_timing = 'all_day',
      breakfast_start = '07:00:00',
      breakfast_end = '11:30:00',
      lunch_start = '12:00:00',
      lunch_end = '16:00:00',
    } = body;

    if (!name_en?.trim() || !name_hi?.trim() || price === undefined) {
      return NextResponse.json(
        { success: false, message: 'English name, Hindi name, and price are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .insert({
        name_en: name_en.trim(),
        name_hi: name_hi.trim(),
        description_en: description_en?.trim() || null,
        description_hi: description_hi?.trim() || null,
        category_id: category_id || null,
        price: Number(price),
        is_veg: Boolean(is_veg),
        image_url: image_url || null,
        is_available: true,
        meal_timing: meal_timing || 'all_day',
        breakfast_start,
        breakfast_end,
        lunch_start,
        lunch_end,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

// PUT: Edit menu item
export async function PUT(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const body = await req.json();
    const {
      id,
      name_en,
      name_hi,
      description_en,
      description_hi,
      category_id,
      price,
      is_veg,
      image_url,
      is_available,
      meal_timing,
      breakfast_start,
      breakfast_end,
      lunch_start,
      lunch_end,
    } = body;

    if (!id || !name_en?.trim() || !name_hi?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Item ID, English name, and Hindi name are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Fetch existing item to check for price change
    const { data: oldItem } = await supabaseAdmin
      .from('menu_items')
      .select('price, name_en, name_hi')
      .eq('id', id)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = {
      name_en: name_en.trim(),
      name_hi: name_hi.trim(),
      description_en: description_en?.trim() || null,
      description_hi: description_hi?.trim() || null,
      category_id: category_id || null,
      price: Number(price),
      is_veg: Boolean(is_veg),
      meal_timing: meal_timing || 'all_day',
      breakfast_start,
      breakfast_end,
      lunch_start,
      lunch_end,
    };

    if (image_url !== undefined) updatePayload.image_url = image_url;
    if (is_available !== undefined) updatePayload.is_available = is_available;

    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Check if price changed
    if (oldItem && price !== undefined && Number(oldItem.price) !== Number(price)) {
      try {
        await recordAuditLog({
          action: 'PRICE_CHANGED',
          entity_type: 'menu_items',
          entity_id: id,
          title: `Price for "${name_en}" changed from ₹${oldItem.price} to ₹${price}`,
          details: {
            item_id: id,
            item_name_en: name_en,
            item_name_hi: name_hi,
            old_price: Number(oldItem.price),
            new_price: Number(price),
            difference: Number(price) - Number(oldItem.price),
          },
        });
      } catch (auditErr) {
        console.warn('PRICE_CHANGED audit log error:', auditErr);
      }
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

// DELETE: Delete menu item
export async function DELETE(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Item ID is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.from('menu_items').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
