'use client';

type SyncScope = 'all' | 'orders' | 'customers' | 'audit' | 'reports';

const CHANNEL_NAME = 'cafe_sheets_realtime_sync';
const STORAGE_KEY = 'cafe_sheets_sync_ping';

/**
 * Broadcasts a Sheets mutation across all open tabs/windows on the same origin
 * (using BroadcastChannel with localStorage fallback for older iOS Safari).
 */
export function broadcastSheetsSync(scope: SyncScope = 'all') {
  if (typeof window === 'undefined') return;
  const payload = { scope, ts: Date.now() };

  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

/**
 * Subscribes to cross-tab Sheets mutation broadcasts and invokes `onSync`.
 */
export function subscribeSheetsSync(onSync: (scope: SyncScope) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let ch: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = ev => {
        const scope = (ev.data?.scope as SyncScope) || 'all';
        onSync(scope);
      };
    }
  } catch {
    // Ignore
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue);
      onSync((parsed?.scope as SyncScope) || 'all');
    } catch {
      onSync('all');
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    if (ch) ch.close();
    window.removeEventListener('storage', onStorage);
  };
}
