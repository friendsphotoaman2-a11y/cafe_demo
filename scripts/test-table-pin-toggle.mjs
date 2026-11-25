import fs from 'fs';
import assert from 'assert';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3099/demo/cafe';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setRequirePin(value) {
  const { data: existing } = await supabase
    .from('manager_settings')
    .select('cafe_tagline')
    .eq('id', 1)
    .single();

  let meta = {};
  try {
    if (existing?.cafe_tagline?.startsWith('{')) meta = JSON.parse(existing.cafe_tagline);
  } catch {}
  meta.require_pin = value;
  meta.table_pin_overrides = {};

  const { error } = await supabase
    .from('manager_settings')
    .update({ require_pin: value, cafe_tagline: JSON.stringify(meta) })
    .eq('id', 1);
  if (error) throw error;
}

async function run() {
  const createdSessionIds = [];
  const createdOrderIds = [];

  // Save original require_pin to restore at end
  const { data: origSettings } = await supabase
    .from('manager_settings')
    .select('require_pin')
    .eq('id', 1)
    .single();
  const originalRequirePin = origSettings?.require_pin ?? false;

  // Fetch one available menu item for order placement test
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name_en')
    .eq('is_available', true)
    .limit(1);
  assert(menuItems && menuItems.length > 0, 'Need at least 1 available menu item for order test');
  const testItem = menuItems[0];

  // Fetch 4 tables
  const { data: tables } = await supabase
    .from('cafe_tables')
    .select('id, table_code, table_number')
    .order('table_code', { ascending: true })
    .limit(4);
  assert(tables && tables.length >= 4, 'Need at least 4 tables in cafe_tables');

  // Close any pre-existing active sessions on those 4 tables for a clean test
  await supabase
    .from('table_sessions')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .in('table_id', tables.map(t => t.id))
    .eq('status', 'ACTIVE');

  try {
    console.log('--- TEST 1: Toggle OFF across 3 tables + no-cache headers + place order ---');
    await setRequirePin(false);

    const offSessions = [];
    for (const tbl of tables.slice(0, 3)) {
      const pageRes = await fetch(`${BASE_URL}/t/${tbl.table_code}`, { cache: 'no-store' });
      assert.strictEqual(pageRes.status, 200, `Page /t/${tbl.table_code} should return 200`);
      const pageCache = pageRes.headers.get('cache-control') || '';
      console.log(`  GET /demo/cafe/t/${tbl.table_code} -> ${pageRes.status}, Cache-Control: ${pageCache}`);
      assert(pageCache.includes('no-store') || pageCache.includes('no-cache'), 'Table page must not be cached');

      const sessRes = await fetch(`${BASE_URL}/api/table/session?table_code=${tbl.table_code}`, { cache: 'no-store' });
      const sessCache = sessRes.headers.get('cache-control') || '';
      assert(sessCache.includes('no-store'), `Session API Cache-Control must include no-store, got: ${sessCache}`);
      const sessData = await sessRes.json();
      assert.strictEqual(sessData.success, true);
      assert.strictEqual(sessData.access, 'granted', `Table ${tbl.table_code} must grant access when PIN OFF`);
      assert.strictEqual(sessData.require_pin, false);
      assert.strictEqual(sessData.active, true);
      assert(sessData.session_id && sessData.session_token);
      createdSessionIds.push(sessData.session_id);
      offSessions.push({ tbl, sessData });
      console.log(`  GET /demo/cafe/api/table/session?table_code=${tbl.table_code} -> access=granted, session=${sessData.session_id}`);
    }

    // Place order on Table 1
    const t1 = offSessions[0];
    const orderRes = await fetch(`${BASE_URL}/api/table/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: t1.sessData.session_id,
        session_token: t1.sessData.session_token,
        device_id: 'test_device_1',
        items: [{ item_id: testItem.id, quantity: 1 }],
      }),
    });
    const orderData = await orderRes.json();
    assert.strictEqual(orderData.success, true, `Order placement in PIN OFF mode failed: ${JSON.stringify(orderData)}`);
    if (orderData.order_id) createdOrderIds.push(orderData.order_id);
    console.log(`  POST /demo/cafe/api/table/order (PIN OFF) -> success=true`);

    // Read Table 1's own orders
    const ownOrdersRes = await fetch(
      `${BASE_URL}/api/table/orders?sessionId=${t1.sessData.session_id}&sessionToken=${t1.sessData.session_token}`
    );
    const ownOrdersData = await ownOrdersRes.json();
    assert.strictEqual(ownOrdersRes.status, 200);
    assert.strictEqual(ownOrdersData.success, true);
    assert(ownOrdersData.orders.length >= 1, 'Table 1 should see its placed order');
    console.log(`  GET /demo/cafe/api/table/orders (own session) -> ${ownOrdersData.orders.length} order(s)`);

    console.log('--- TEST 2: Toggle OFF cross-table isolation ---');
    const t2 = offSessions[1];
    const crossRes = await fetch(
      `${BASE_URL}/api/table/orders?sessionId=${t2.sessData.session_id}&sessionToken=${t1.sessData.session_token}`
    );
    assert.strictEqual(crossRes.status, 403, 'Cross-table order read must be denied with 403');
    console.log(`  GET /demo/cafe/api/table/orders (T2 sessionId with T1 token) -> ${crossRes.status} Denied`);

    console.log('--- TEST 3: Toggle ON -> PIN required, wrong PIN msg, 5-attempt lock, correct PIN ---');
    await setRequirePin(true);
    const t4 = tables[3];
    const onCheckRes = await fetch(`${BASE_URL}/api/table/session?table_code=${t4.table_code}`, { cache: 'no-store' });
    const onCheckData = await onCheckRes.json();
    assert.strictEqual(onCheckData.access, 'pin_required');
    assert.strictEqual(onCheckData.require_pin, true);
    console.log(`  GET /demo/cafe/api/table/session?table_code=${t4.table_code} (PIN ON) -> access=pin_required`);

    // Generate PIN for T4
    const { data: genSess, error: genErr } = await supabase.rpc('generate_table_session', { p_table_id: t4.id });
    if (genErr) throw genErr;
    createdSessionIds.push(genSess.session_id);
    const correctPin = genSess.pin_code;
    const wrongPin = correctPin === '9999' ? '8888' : '9999';

    // 4 wrong attempts -> invalid message; 5th -> locked
    for (let i = 1; i <= 5; i++) {
      const vpRes = await fetch(`${BASE_URL}/api/table/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_code: t4.table_code, pin: wrongPin }),
      });
      const vpData = await vpRes.json();
      assert.strictEqual(vpData.success, false);
      if (i < 5) {
        assert.strictEqual(
          vpData.message,
          'Invalid PIN. Please talk to the manager and get your PIN again.'
        );
      } else {
        assert.strictEqual(vpData.locked, true, '5th wrong attempt must lock table');
      }
    }
    console.log('  Wrong PIN x5 -> invalid message + 5-attempt lockout verified');

    // Regenerate PIN for T4 and verify correct PIN
    const { data: genSess2, error: genErr2 } = await supabase.rpc('generate_table_session', { p_table_id: t4.id });
    if (genErr2) throw genErr2;
    createdSessionIds.push(genSess2.session_id);

    const goodPinRes = await fetch(`${BASE_URL}/api/table/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_code: t4.table_code, pin: genSess2.pin_code }),
    });
    const goodPinData = await goodPinRes.json();
    assert.strictEqual(goodPinData.success, true);
    assert.strictEqual(goodPinData.session_id, genSess2.session_id);
    console.log('  Correct PIN -> verified & unlocked');

    console.log('--- TEST 4: Existing open session survives OFF -> ON, and old PIN-ON session works in OFF ---');
    // T1's open session from OFF mode still works when ON
    const t1StillOpenRes = await fetch(
      `${BASE_URL}/api/table/session?table_code=${t1.tbl.table_code}&session_id=${t1.sessData.session_id}&session_token=${t1.sessData.session_token}`,
      { cache: 'no-store' }
    );
    const t1StillOpen = await t1StillOpenRes.json();
    assert.strictEqual(t1StillOpen.access, 'granted');
    assert.strictEqual(t1StillOpen.active, true);
    console.log('  Open session kept working after OFF -> ON');

    // Switch back to OFF: T4 (which has an active PIN-ON session) grants access directly without PIN
    await setRequirePin(false);
    const t4OffRes = await fetch(`${BASE_URL}/api/table/session?table_code=${t4.table_code}`, { cache: 'no-store' });
    const t4OffData = await t4OffRes.json();
    assert.strictEqual(t4OffData.access, 'granted');
    assert.strictEqual(t4OffData.require_pin, false);
    assert.strictEqual(t4OffData.session_id, genSess2.session_id, 'Should reuse existing active session cleanly');
    console.log('  PIN-ON session reused cleanly when switched to OFF (no PIN prompt)');

    console.log('ALL TESTS PASSED!');
  } finally {
    // Cleanup test orders & sessions and restore original setting
    if (createdOrderIds.length > 0) {
      await supabase.from('order_items').delete().in('order_id', createdOrderIds);
      await supabase.from('orders').delete().in('id', createdOrderIds);
    }
    if (createdSessionIds.length > 0) {
      await supabase.from('orders').delete().in('session_id', createdSessionIds);
      await supabase.from('table_sessions').delete().in('id', createdSessionIds);
    }
    await setRequirePin(originalRequirePin);
  }
}

run().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
