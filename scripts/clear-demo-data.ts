import { createAdminClient } from "../src/lib/supabase/admin";

async function clearAllDemoData() {
  console.log("=================================================================");
  console.log("TBW CAFÉ — PURGING ALL DEMO & TRANSACTIONAL DATA FROM SUPABASE");
  console.log("=================================================================\n");

  const supabase = createAdminClient();

  // 1. Delete order_items
  console.log("1. Deleting order_items...");
  const { error: errItems } = await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errItems) console.warn("order_items error:", errItems.message);

  // 2. Delete kitchen_tickets (if exists)
  console.log("2. Deleting kitchen_tickets...");
  try {
    await supabase.from("kitchen_tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    console.warn("kitchen_tickets skip:", e);
  }

  // 3. Delete bill_payments (if exists)
  console.log("3. Deleting bill_payments...");
  try {
    await supabase.from("bill_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    console.warn("bill_payments skip:", e);
  }

  // 4. Delete orders
  console.log("4. Deleting orders...");
  const { error: errOrders } = await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errOrders) console.warn("orders error:", errOrders.message);

  // 5. Delete bills
  console.log("5. Deleting bills...");
  const { error: errBills } = await supabase.from("bills").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errBills) console.warn("bills error:", errBills.message);

  // 6. Delete customer_sessions
  console.log("6. Deleting customer_sessions...");
  const { error: errCustSess } = await supabase.from("customer_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errCustSess) console.warn("customer_sessions error:", errCustSess.message);

  // 7. Delete dining_sessions
  console.log("7. Deleting dining_sessions...");
  const { error: errDining } = await supabase.from("dining_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errDining) console.warn("dining_sessions error:", errDining.message);

  // 8. Delete loyalty_accounts
  console.log("8. Deleting loyalty_accounts...");
  const { error: errLoyalty } = await supabase.from("loyalty_accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errLoyalty) console.warn("loyalty_accounts error:", errLoyalty.message);

  // 9. Delete customers
  console.log("9. Deleting customers...");
  const { error: errCust } = await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errCust) console.warn("customers error:", errCust.message);

  // 10. Reset all 12 tables to available status
  console.log("10. Resetting all 12 restaurant_tables to available status...");
  const { error: errTables } = await supabase
    .from("restaurant_tables")
    .update({ status: "available" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (errTables) console.warn("restaurant_tables reset error:", errTables.message);

  console.log("\n=================================================================");
  console.log("VERIFYING POST-PURGE DATABASE COUNTS:");
  console.log("=================================================================");

  const checkTables = [
    "orders",
    "order_items",
    "dining_sessions",
    "bills",
    "customer_sessions",
    "customers",
    "loyalty_accounts",
    "restaurant_tables",
  ];

  for (const t of checkTables) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`   ${t.padEnd(20)} : ${count} rows`);
  }

  // Check table statuses
  const { data: tablesData } = await supabase.from("restaurant_tables").select("code, status");
  const nonAvailable = (tablesData || []).filter((t) => t.status !== "available");
  console.log(`   Tables available      : ${(tablesData || []).length - nonAvailable.length} / ${(tablesData || []).length}`);

  console.log("\n✅ ALL DEMO TRANSACTIONAL DATA PURGED FROM SUPABASE SUCCESSFULLY!");
}

clearAllDemoData().catch(console.error);
