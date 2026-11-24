import {
  appendAuditLogToSheet,
  readAuditLogsFromSheet,
  deleteAuditLogFromSheet,
} from '@/lib/google-sheets';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSheetsCache, setSheetsCache, invalidateSheetsCache } from '@/lib/sheets-cache';
import { parseSheetDate } from '@/lib/date-utils';

export type AuditAction =
  | 'PIN_GENERATED'
  | 'ORDER_CANCELLED'
  | 'AVAILABILITY_CHANGED'
  | 'PRICE_CHANGED'
  | 'MENU_ITEM_DELETED'
  | 'SETTINGS_CHANGED'
  | 'PIN_MODE_CHANGED'
  | string;

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor_email: string;
  entity_type: string;
  entity_id: string;
  title: string;
  details: Record<string, unknown>;
}

async function getConfiguredSheetId(): Promise<string | null> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from('manager_settings')
      .select('google_sheet_id')
      .eq('id', 1)
      .maybeSingle();
    return data?.google_sheet_id || null;
  } catch {
    return null;
  }
}

/**
 * Records an audit log entry directly in Google Sheets AuditLog tab (no Supabase / disk persistence).
 */
export async function recordAuditLog(params: {
  action: AuditAction;
  actor_email?: string;
  entity_type: string;
  entity_id: string;
  title: string;
  details?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const actor = params.actor_email || 'manager@cafe.com';
  const timestamp = new Date().toISOString();
  const id = `sheet-audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newEntry: AuditLogEntry = {
    id,
    timestamp,
    action: params.action,
    actor_email: actor,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    title: params.title,
    details: params.details || {},
  };

  const customSheetId = await getConfiguredSheetId();
  await appendAuditLogToSheet(
    {
      timestamp,
      action: params.action,
      actor,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      title: params.title,
      details: params.details || {},
    },
    customSheetId
  ).catch(e => console.warn('Google Sheets audit log append warning:', e));

  invalidateSheetsCache('auditLogs');
  return newEntry;
}

/**
 * Fetches audit logs strictly from Google Sheets AuditLog tab sorted newest first.
 */
export async function getAuditLogs(options?: {
  action?: string;
  dateFilter?: string;
  limit?: number;
  forceRefresh?: boolean;
}): Promise<AuditLogEntry[]> {
  let logs: AuditLogEntry[] = [];
  const cached = getSheetsCache<AuditLogEntry[]>('auditLogs', options?.forceRefresh);

  if (cached) {
    logs = [...cached.data];
  } else {
    const customSheetId = await getConfiguredSheetId();
    const sheetRes = await readAuditLogsFromSheet(customSheetId);
    logs = sheetRes.success ? (sheetRes.logs as AuditLogEntry[]) : [];
    setSheetsCache('auditLogs', logs);
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (options?.action && options.action !== 'ALL') {
    logs = logs.filter(l => l.action.toUpperCase() === options.action?.toUpperCase());
  }

  if (options?.dateFilter && options.dateFilter !== 'all') {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const toIstDate = (ts: string) => {
      const d = parseSheetDate(ts);
      return d ? d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ts.slice(0, 10);
    };

    if (options.dateFilter === 'today') {
      logs = logs.filter(l => toIstDate(l.timestamp) === todayStr);
    } else if (options.dateFilter === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      logs = logs.filter(l => toIstDate(l.timestamp) === yestStr);
    } else if (options.dateFilter === 'last_7_days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      logs = logs.filter(l => {
        const d = parseSheetDate(l.timestamp);
        return d ? d >= sevenDaysAgo : false;
      });
    } else if (options.dateFilter === 'last_30_days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      logs = logs.filter(l => {
        const d = parseSheetDate(l.timestamp);
        return d ? d >= thirtyDaysAgo : false;
      });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(options.dateFilter)) {
      logs = logs.filter(l => toIstDate(l.timestamp) === options.dateFilter);
    }
  }

  if (options?.limit && options.limit > 0) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

/**
 * Deletes an audit log entry or clears all entries from Google Sheets AuditLog tab.
 */
export async function removeAuditLogs(params: {
  timestamp?: string;
  entity_id?: string;
  clearAll?: boolean;
}) {
  const customSheetId = await getConfiguredSheetId();
  const res = await deleteAuditLogFromSheet(params, customSheetId);
  invalidateSheetsCache('auditLogs');
  return res;
}
