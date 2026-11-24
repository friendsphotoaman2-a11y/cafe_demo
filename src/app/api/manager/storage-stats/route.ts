import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyManagerAuth } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await verifyManagerAuth(req);
  if (!auth.allowed) return auth.response!;

  try {
    const supabaseAdmin = createAdminClient();

    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('menu-images')
      .list('items', { limit: 500 });

    if (listErr) {
      return NextResponse.json({ success: true, total_files: 0, total_size_mb: '0.00' });
    }

    let totalSizeBytes = 0;
    let validFilesCount = 0;

    (files || []).forEach(f => {
      if (f.name !== '.emptyFolderPlaceholder') {
        validFilesCount++;
        totalSizeBytes += f.metadata?.size || 0;
      }
    });

    const totalMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      total_files: validFilesCount,
      total_size_mb: totalMb,
      total_size_kb: Math.round(totalSizeBytes / 1024),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
