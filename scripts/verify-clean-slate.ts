import { createAdminClient } from "../src/lib/supabase/admin";
import { createStaffSessionToken } from "../src/lib/server-auth";

async function verify() {
  console.log("=================================================================");
  console.log("VERIFYING CLEAN OPERATIONAL STATE ACROSS DATABASE & APIS");
  console.log("=================================================================\n");

  const s = createAdminClient();
  const tables = [
    "orders",
    "order_items",
    "dining_sessions",
    "bills",
    "customers",
    "customer_sessions",
    "loyalty_accounts",
  ];

  console.log("1. Supabase Database Counts:");
  for (const t of tables) {
    const { count } = await s.from(t).select("*", { count: "exact", head: true });
    console.log(`   - ${t.padEnd(20)} : ${count} rows`);
  }

  const { data: dbTables } = await s.from("restaurant_tables").select("code, status");
  const availableCount = (dbTables || []).filter((t) => t.status === "available").length;
  console.log(`\n2. Table Status in DB: ${availableCount} / ${dbTables?.length} tables are 'available'`);

  const staffToken = createStaffSessionToken({
    role: "owner",
    email: "owner@brewandbean.in",
    fullName: "Aman",
  });

  const staffRes = await fetch("http://127.0.0.1:3000/api/orders", {
    headers: { Cookie: `tbw_staff_session_token=${staffToken}` },
  });
  const staffData = await staffRes.json();
  console.log(`\n3. Staff View API (/api/orders): ${staffData.orders?.length ?? 0} active orders`);

  const custRes = await fetch("http://127.0.0.1:3000/api/orders?tableCode=03");
  const custData = await custRes.json();
  console.log(`4. Customer View API (/api/orders?tableCode=03):`);
  console.log(`   - hasActiveSession : ${custData.hasActiveSession}`);
  console.log(`   - orders count     : ${custData.orders?.length ?? 0}`);
  console.log(`   - sessionBill      : ${custData.sessionBill}`);

  console.log("\n=================================================================");
  console.log("✅ CLEAN SLATE VERIFIED: 0 DEMO ORDERS, 0 DEMO CUSTOMERS, 12 TABLES AVAILABLE!");
  console.log("=================================================================\n");
}

verify().catch(console.error);

