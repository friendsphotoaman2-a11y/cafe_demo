import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Can be triggered by Vercel Cron or manual manager trigger
export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    // 1. List files in storage bucket 'menu-images' under 'items'
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('menu-images')
      .list('items', { limit: 500 });

    if (listErr) {
      return NextResponse.json({ success: false, message: listErr.message }, { status: 500 });
    }

    // 2. Fetch all current image_urls from menu_items
    const { data: items } = await supabaseAdmin
      .from('menu_items')
      .select('image_url');

    const referencedPaths = new Set<string>();
    const marker = '/menu-images/';
    (items || []).forEach(it => {
      if (it.image_url && it.image_url.includes(marker)) {
        const p = it.image_url.substring(it.image_url.indexOf(marker) + marker.length);
        referencedPaths.add(p);
      }
    });

    // 3. Identify orphaned files
    const orphanedFiles: string[] = [];
    let totalSizeBytes = 0;

    (files || []).forEach(f => {
      const fullPath = `items/${f.name}`;
      totalSizeBytes += f.metadata?.size || 0;
      if (!referencedPaths.has(fullPath) && f.name !== '.emptyFolderPlaceholder') {
        orphanedFiles.push(fullPath);
      }
    });

    let deletedCount = 0;
    if (orphanedFiles.length > 0) {
      const { error: removeErr } = await supabaseAdmin.storage
        .from('menu-images')
        .remove(orphanedFiles);

      if (!removeErr) {
        deletedCount = orphanedFiles.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Storage cleanup complete. Removed ${deletedCount} orphaned images.`,
      total_files: (files || []).length - deletedCount,
      total_size_mb: Number((totalSizeBytes / (1024 * 1024)).toFixed(2)),
      deleted_orphans: deletedCount,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
