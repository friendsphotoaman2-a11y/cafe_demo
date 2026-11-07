import { createAdminClient } from "../src/lib/supabase/admin";

async function inspectAll() {
  const supabase = createAdminClient();

  const tables = [
    "restaurants",
    "staff_members",
    "restaurant_tables",
    "menu_categories",
    "menu_items",
    "customization_groups",
    "customization_options",
    "customers",
    "customer_sessions",
    "dining_sessions",
    "orders",
    "order_items",
    "kitchen_tickets",
    "bills",
    "bill_payments",
    "payment_audit_logs",
    "loyalty_accounts",
    "loyalty_transactions",
    "cafe_settings"
  ];

  console.log("=== SUPABASE TABLE INSPECTION ===");
  const results: Record<string, { count: number; sample?: unknown[] }> = {};

  for (const t of tables) {
    try {
      const { data, count, error } = await supabase
        .from(t)
        .select("*", { count: "exact" })
        .limit(3);

      if (error) {
        results[t] = { count: -1, sample: [error.message] };
      } else {
        results[t] = { count: count ?? (data?.length || 0), sample: data || [] };
      }
    } catch (e: unknown) {
      results[t] = { count: -1, sample: [(e as Error).message] };
    }
  }

  for (const [table, res] of Object.entries(results)) {
    console.log(`${table.padEnd(25)} : ${res.count} rows`);
  }

  console.log("\n=== DETAILED SAMPLES ===");
  console.log("CUSTOMERS:", JSON.stringify(results["customers"]?.sample, null, 2));
  console.log("ORDERS:", JSON.stringify(results["orders"]?.sample, null, 2));
  console.log("BILLS:", JSON.stringify(results["bills"]?.sample, null, 2));
  console.log("LOYALTY:", JSON.stringify(results["loyalty_accounts"]?.sample, null, 2));
  console.log("DINING SESSIONS:", JSON.stringify(results["dining_sessions"]?.sample, null, 2));
  console.log("CUSTOMER SESSIONS:", JSON.stringify(results["customer_sessions"]?.sample, null, 2));
}

inspectAll().catch(console.error);

