import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type PinOverrideMode = 'DEFAULT' | 'ON' | 'OFF';

export type TableAccessResult =
  | {
      access: 'granted';
      require_pin: boolean;
      active: true;
      session_id: string;
      session_token: string;
      table_id: string;
      table_number: string;
      table_code: string;
    }
  | {
      access: 'pin_required';
      require_pin: true;
      active: false;
      has_active_session: boolean;
      is_locked: boolean;
      table_id: string;
      table_number: string;
      table_code: string;
      message?: string;
    }
  | {
      access: 'not_found';
      message: string;
    }
  | {
      access: 'error';
      message: string;
    };

function parseBooleanStrict(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

// Per-table in-process lock to prevent concurrent PIN-OFF requests from creating duplicate ACTIVE sessions
const inflightPinOffCreations = new Map<string, Promise<TableAccessResult>>();

async function getOrCreateCanonicalPinOffSession(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  table: { id: string; table_number: string; table_code: string }
): Promise<TableAccessResult> {
  const { data: activeSessions, error: existingErr } = await supabaseAdmin
    .from('table_sessions')
    .select('id, session_token, status, locked_until, opened_at')
    .eq('table_id', table.id)
    .eq('status', 'ACTIVE')
    .order('opened_at', { ascending: true });

  if (existingErr) {
    console.error('[resolveTableAccess] Error finding active session (PIN OFF):', existingErr);
    return { access: 'error', message: 'Failed to load table session.' };
  }

  if (activeSessions && activeSessions.length > 0) {
    const canonical = activeSessions[0];
    // Consolidate any duplicate ACTIVE sessions created by cross-instance races
    if (activeSessions.length > 1) {
      const duplicateIds = activeSessions.slice(1).map(s => s.id);
      await Promise.all([
        supabaseAdmin.from('orders').update({ session_id: canonical.id }).in('session_id', duplicateIds),
        supabaseAdmin.from('waiter_calls').update({ session_id: canonical.id }).in('session_id', duplicateIds),
        supabaseAdmin
          .from('table_sessions')
          .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
          .in('id', duplicateIds),
      ]).catch(err => console.warn('[resolveTableAccess] Duplicate session cleanup warning:', err));
    }

    return {
      access: 'granted',
      require_pin: false,
      active: true,
      session_id: canonical.id,
      session_token: canonical.session_token,
      table_id: table.id,
      table_number: table.table_number,
      table_code: table.table_code,
    };
  }

  // Create ONE new active session with a valid UUID session_token
  const newToken = crypto.randomUUID();
  const { data: newSession, error: createErr } = await supabaseAdmin
    .from('table_sessions')
    .insert({
      table_id: table.id,
      pin_code: '0000',
      session_token: newToken,
      status: 'ACTIVE',
      opened_at: new Date().toISOString(),
    })
    .select('id, session_token')
    .single();

  if (createErr || !newSession) {
    console.error('[resolveTableAccess] Failed to create PIN-OFF session:', createErr);
    return { access: 'error', message: 'Failed to open table session.' };
  }

  // Double-check after insert in case another serverless instance inserted concurrently
  const { data: postInsertSessions } = await supabaseAdmin
    .from('table_sessions')
    .select('id, session_token, opened_at')
    .eq('table_id', table.id)
    .eq('status', 'ACTIVE')
    .order('opened_at', { ascending: true });

  if (postInsertSessions && postInsertSessions.length > 1) {
    const canonical = postInsertSessions[0];
    const duplicateIds = postInsertSessions.slice(1).map(s => s.id);
    await Promise.all([
      supabaseAdmin.from('orders').update({ session_id: canonical.id }).in('session_id', duplicateIds),
      supabaseAdmin.from('waiter_calls').update({ session_id: canonical.id }).in('session_id', duplicateIds),
      supabaseAdmin
        .from('table_sessions')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .in('id', duplicateIds),
    ]).catch(() => {});

    return {
      access: 'granted',
      require_pin: false,
      active: true,
      session_id: canonical.id,
      session_token: canonical.session_token,
      table_id: table.id,
      table_number: table.table_number,
      table_code: table.table_code,
    };
  }

  return {
    access: 'granted',
    require_pin: false,
    active: true,
    session_id: newSession.id,
    session_token: newSession.session_token,
    table_id: table.id,
    table_number: table.table_number,
    table_code: table.table_code,
  };
}

/**
 * Single server-side source of truth for table access and PIN enforcement.
 * Reads manager_settings and cafe_tables using the Supabase service role,
 * computes effective_require_pin, and either grants direct access (PIN OFF)
 * or enforces PIN verification (PIN ON).
 */
export async function resolveTableAccess(
  rawTableCode: string,
  options?: { sessionId?: string; sessionToken?: string }
): Promise<TableAccessResult> {
  const tableCode = (rawTableCode || '').trim().toUpperCase();
  if (!tableCode) {
    return { access: 'not_found', message: 'Table not found' };
  }

  const supabaseAdmin = createAdminClient();

  // 1 & 2. Look up table and global PIN settings in parallel
  const [
    { data: table, error: tableErr },
    { data: settingsRow, error: settingsErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('cafe_tables')
      .select('id, table_number, table_code, pin_override')
      .ilike('table_code', tableCode)
      .maybeSingle(),
    supabaseAdmin
      .from('manager_settings')
      .select('require_pin, cafe_tagline')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  if (tableErr) {
    console.error('[resolveTableAccess] Error querying cafe_tables:', tableErr);
    return { access: 'error', message: 'Failed to look up table.' };
  }

  if (!table) {
    return { access: 'not_found', message: 'Table not found' };
  }

  if (settingsErr) {
    console.error('[resolveTableAccess] Failed to read manager_settings:', settingsErr);
    return { access: 'error', message: 'Failed to read table PIN settings.' };
  }

  if (!settingsRow) {
    console.error('[resolveTableAccess] manager_settings row id=1 is missing!');
    return { access: 'error', message: 'Table PIN settings row not found.' };
  }

  let masterRequirePin = true;
  let tableOverrides: Record<string, PinOverrideMode> = {};

  if ((settingsRow as Record<string, unknown>).require_pin !== undefined && (settingsRow as Record<string, unknown>).require_pin !== null) {
    masterRequirePin = parseBooleanStrict((settingsRow as Record<string, unknown>).require_pin, true);
  } else if (settingsRow.cafe_tagline && settingsRow.cafe_tagline.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(settingsRow.cafe_tagline);
      if (parsed.require_pin !== undefined) {
        masterRequirePin = parseBooleanStrict(parsed.require_pin, true);
      }
    } catch (parseErr) {
      console.error('[resolveTableAccess] Failed to parse cafe_tagline JSON:', parseErr);
    }
  }

  if (settingsRow.cafe_tagline && settingsRow.cafe_tagline.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(settingsRow.cafe_tagline);
      if (parsed.table_pin_overrides && typeof parsed.table_pin_overrides === 'object') {
        tableOverrides = parsed.table_pin_overrides;
      }
    } catch {
      // Already logged above if malformed
    }
  }

  // 3. Compute effective_require_pin: per-table override if ON/OFF, else global toggle
  const rawOverride =
    tableOverrides[table.id] ||
    ((table as Record<string, unknown>).pin_override as PinOverrideMode | undefined) ||
    'DEFAULT';
  const normalizedOverride = String(rawOverride).toUpperCase();

  let effectiveRequirePin = masterRequirePin;
  if (normalizedOverride === 'ON') effectiveRequirePin = true;
  else if (normalizedOverride === 'OFF') effectiveRequirePin = false;

  const savedSessionId = (options?.sessionId || '').trim();
  const savedSessionToken = (options?.sessionToken || '').trim();

  // 4. Validate an already-open saved session if provided (keeps open sessions working across toggle changes)
  if (savedSessionId || savedSessionToken) {
    let query = supabaseAdmin
      .from('table_sessions')
      .select('id, session_token, status, locked_until')
      .eq('table_id', table.id)
      .eq('status', 'ACTIVE');

    if (savedSessionId) query = query.eq('id', savedSessionId);
    if (savedSessionToken) query = query.eq('session_token', savedSessionToken);

    const { data: activeSession, error: sessErr } = await query.maybeSingle();

    if (sessErr) {
      console.error('[resolveTableAccess] Error checking saved session:', sessErr);
    } else if (activeSession && activeSession.status === 'ACTIVE') {
      const isLocked = Boolean(
        activeSession.locked_until && new Date(activeSession.locked_until) > new Date()
      );
      if (!isLocked) {
        return {
          access: 'granted',
          require_pin: effectiveRequirePin,
          active: true,
          session_id: activeSession.id,
          session_token: activeSession.session_token,
          table_id: table.id,
          table_number: table.table_number,
          table_code: table.table_code,
        };
      }
    }
  }

  // 5. PIN OFF MODE: Get or create ONE canonical open session for this table, grant access immediately
  if (!effectiveRequirePin) {
    const existingPromise = inflightPinOffCreations.get(table.id);
    if (existingPromise) {
      return existingPromise;
    }
    const creationPromise = getOrCreateCanonicalPinOffSession(supabaseAdmin, table).finally(() => {
      inflightPinOffCreations.delete(table.id);
    });
    inflightPinOffCreations.set(table.id, creationPromise);
    return creationPromise;
  }

  // 6. PIN ON MODE: Require valid PIN for this table's open session
  const { data: currentSession, error: curErr } = await supabaseAdmin
    .from('table_sessions')
    .select('id, status, locked_until, failed_attempts')
    .eq('table_id', table.id)
    .eq('status', 'ACTIVE')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (curErr) {
    console.error('[resolveTableAccess] Error checking current session (PIN ON):', curErr);
  }

  const isLocked = Boolean(
    (Number(currentSession?.failed_attempts) >= 5) ||
    (currentSession?.locked_until && new Date(currentSession.locked_until) > new Date())
  );

  return {
    access: 'pin_required',
    require_pin: true,
    active: false,
    has_active_session: Boolean(currentSession && !isLocked),
    is_locked: isLocked,
    table_id: table.id,
    table_number: table.table_number,
    table_code: table.table_code,
    ...(savedSessionId || savedSessionToken ? { message: 'Session has ended or is invalid.' } : {}),
  };
}
