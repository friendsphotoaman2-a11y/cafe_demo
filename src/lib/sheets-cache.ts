/**
 * Lightweight in-memory TTL cache shared across Google Sheets API routes
 * so mutations (billing settled, order/customer/audit deletion) invalidate caches immediately.
 */

interface CacheSlot<T> {
  timestamp: number;
  data: T;
}

const slots = new Map<string, CacheSlot<unknown>>();

export const SHEETS_CACHE_TTL_MS = 4_000; // 4 seconds for near-realtime Sheet mirroring within quota

export function getSheetsCache<T>(key: string, forceRefresh = false): { data: T; ageSec: number } | null {
  if (forceRefresh) return null;
  const entry = slots.get(key);
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  if (ageMs >= SHEETS_CACHE_TTL_MS) return null;
  return {
    data: entry.data as T,
    ageSec: Math.round(ageMs / 1000),
  };
}

export function setSheetsCache<T>(key: string, data: T): void {
  slots.set(key, {
    timestamp: Date.now(),
    data,
  });
}

export function invalidateSheetsCache(...keys: string[]): void {
  if (keys.length === 0) {
    slots.clear();
    return;
  }
  for (const k of keys) {
    slots.delete(k);
  }
}
