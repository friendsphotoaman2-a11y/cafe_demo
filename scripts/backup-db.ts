import { createAdminClient } from "../src/lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

async function backup() {
  const s = createAdminClient();
  const tables = [
    "customers",
    "customer_sessions",
    "dining_sessions",
    "orders",
    "order_items",
    "bills",
    "loyalty_accounts",
    "restaurant_tables"
  ];

  const backupData: Record<string, unknown> = {};
  for (const t of tables) {
    const { data, error } = await s.from(t).select("*");
    if (error) {
      console.warn(`Warning on ${t}: ${error.message}`);
    }
    backupData[t] = data || [];
  }

  const outPath = path.join(process.cwd(), "scripts", "backup-data.json");
  fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2));
  console.log("BACKUP COMPLETED:", outPath);
}

backup().catch(console.error);

