import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

// POST: Add new category
export async function POST(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { name_en, name_hi, display_order = 1 } = await req.json();

    if (!name_en?.trim() || !name_hi?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Both English and Hindi names are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name_en: name_en.trim(),
        name_hi: name_hi.trim(),
        display_order: Number(display_order) || 1,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

// PUT: Edit existing category
export async function PUT(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { id, name_en, name_hi, display_order } = await req.json();

    if (!id || !name_en?.trim() || !name_hi?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Category ID, English name, and Hindi name are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({
        name_en: name_en.trim(),
        name_hi: name_hi.trim(),
        display_order: Number(display_order) || 1,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

// DELETE: Delete category
export async function DELETE(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Category ID is required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Detach any menu_items from this category first
    await supabaseAdmin
      .from('menu_items')
      .update({ category_id: null })
      .eq('category_id', id);

    const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
