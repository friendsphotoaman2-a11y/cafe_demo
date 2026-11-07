import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Probe the restaurant_tables table to test schema presence
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("id, code")
      .limit(1);

    if (error) {
      const isMissingTable =
        error.code === "PGRST205" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist");

      return NextResponse.json({
        connected: true,
        migrated: false,
        status: "migrations_pending",
        errorCode: error.code,
        error: error.message,
        hint: isMissingTable
          ? "Remote database is reachable, but SQL migrations have not been executed yet. Run migration files in the Supabase SQL Editor."
          : error.message,
        tableCount: 0,
      });
    }

    // If tables exist, count tables configured
    const { count } = await supabase
      .from("restaurant_tables")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      connected: true,
      migrated: true,
      status: "schema_verified",
      message: "Supabase database schema verified and accessible.",
      sampleTableDetected: (data && data.length > 0) || false,
      configuredTablesCount: count ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      connected: false,
      migrated: false,
      status: "connection_error",
      error: message,
    });
  }
}
