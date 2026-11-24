import fs from 'fs';
import path from 'path';
import { appendAuditLogToSheet, readAuditLogsFromSheet } from '@/lib/google-sheets';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  | 'PIN_GENERATED'
  | 'ORDER_CANCELLED'
  | 'AVAILABILITY_CHANGED'
  | 'PRICE_CHANGED';

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

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalAuditLogs(): AuditLogEntry[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(AUDIT_FILE)) {
      return [];
    }
    const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading local audit logs file:', err);
    return [];
  }
}

function writeLocalAuditLogs(entries: AuditLogEntry[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error writing local audit logs file:', err);
  }
}

/**
 * Records an audit log entry across:
 * 1. Local disk file (instant)
 * 2. Google Sheets AuditLog tab (async background cloud ledger)
 * 3. Supabase audit table (if present)
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
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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

  // 1. Save to local disk
  try {
    const existing = readLocalAuditLogs();
    existing.unshift(newEntry);
    // Keep last 1000 entries locally
    if (existing.length > 1000) {
      existing.length = 1000;
    }
    writeLocalAuditLogs(existing);
  } catch (e) {
    console.warn('Failed to save audit log to disk:', e);
  }

  // 2. Asynchronously append to Google Sheet AuditLog tab
  appendAuditLogToSheet({
    timestamp,
    action: params.action,
    actor,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    title: params.title,
    details: params.details || {},
  }).catch(e => console.warn('Background sheet audit log append error:', e));

  // 3. Optional Supabase insert if table exists
  try {
    const supabase = createAdminClient();
    Promise.resolve(
      supabase.from('audit_logs').insert({
        action: params.action,
        actor_email: actor,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        details: params.details || {},
        created_at: timestamp,
      })
    ).catch(() => {});
  } catch {
    // Ignore Supabase table absence
  }

  return newEntry;
}

/**
 * Fetches audit logs sorted newest first, with action and date filters.
 */
export async function getAuditLogs(options?: {
  action?: string;
  dateFilter?: string; // 'all' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'YYYY-MM-DD'
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let logs = readLocalAuditLogs();

  // If local file is empty, fallback to reading from Google Sheets
  if (logs.length === 0) {
    try {
      const sheetLogs = await readAuditLogsFromSheet();
      if (sheetLogs.length > 0) {
        logs = sheetLogs as AuditLogEntry[];
        writeLocalAuditLogs(logs);
      }
    } catch {
      // Ignore
    }
  }

  // Sort newest first
  logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Filter by action
  if (options?.action && options.action !== 'ALL') {
    logs = logs.filter(
      l => l.action.toUpperCase() === options.action?.toUpperCase()
    );
  }

  // Filter by date
  if (options?.dateFilter && options.dateFilter !== 'all') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (options.dateFilter === 'today') {
      logs = logs.filter(l => l.timestamp.startsWith(todayStr));
    } else if (options.dateFilter === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = yesterday.toISOString().split('T')[0];
      logs = logs.filter(l => l.timestamp.startsWith(yestStr));
    } else if (options.dateFilter === 'last_7_days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      logs = logs.filter(l => new Date(l.timestamp) >= sevenDaysAgo);
    } else if (options.dateFilter === 'last_30_days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      logs = logs.filter(l => new Date(l.timestamp) >= thirtyDaysAgo);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(options.dateFilter)) {
      logs = logs.filter(l => l.timestamp.startsWith(options.dateFilter!));
    }
  }

  if (options?.limit && options.limit > 0) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}
