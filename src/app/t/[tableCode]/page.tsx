import React from 'react';
import { cookies } from 'next/headers';
import { resolveTableAccess } from '@/lib/table-access';
import { getCachedMenuAndSettings } from '@/lib/cafe-cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { TableClient } from '@/components/TableClient';
import { Order } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TablePage({
  params,
}: {
  params: Promise<{ tableCode?: string; table_code?: string }>;
}) {
  const resolvedParams = await params;
  const rawCode = resolvedParams.tableCode || resolvedParams.table_code || '';
  const tableCode = rawCode.trim().toUpperCase();

  const cookieStore = await cookies();
  const cookieSessionToken = cookieStore.get(`cafe_session_${tableCode}`)?.value || '';
  const cookieSessionId = cookieStore.get(`cafe_session_id_${tableCode}`)?.value || '';

  const [accessResult, menuData] = await Promise.all([
    resolveTableAccess(tableCode, {
      sessionId: cookieSessionId,
      sessionToken: cookieSessionToken,
    }),
    getCachedMenuAndSettings(),
  ]);

  let initialOrders: Order[] = [];
  if (accessResult.access === 'granted' && accessResult.session_id) {
    try {
      const supabaseAdmin = createAdminClient();
      const { data: ordersData } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('session_id', accessResult.session_id)
        .order('created_at', { ascending: false });
      if (Array.isArray(ordersData)) {
        initialOrders = ordersData as Order[];
      }
    } catch {
      // Fallback gracefully; client polling will populate if needed
    }
  }

  return (
    <TableClient
      tableCode={tableCode}
      initialAccess={accessResult}
      initialCategories={menuData.categories}
      initialMenuItems={menuData.menuItems}
      initialSettings={menuData.settings}
      initialOrders={initialOrders}
      hadSessionCookie={Boolean(cookieSessionId || cookieSessionToken)}
    />
  );
}
