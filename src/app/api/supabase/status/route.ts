import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Check if tables exist
    const { data: tablesData, error: tablesError } = await supabase
      .from("restaurant_tables")
      .select("count", { count: "exact", head: true });

    if (tablesError) {
      return NextResponse.json({
        connected: true,
        migrated: false,
        error: tablesError.message,
        hint: "Run the SQL migration in Supabase SQL Editor: supabase/migrations/20261107000001_initial_cafe_schema.sql",
      });
    }

    return NextResponse.json({
      connected: true,
      migrated: true,
      message: "Supabase database schema verified and accessible.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      connected: false,
      migrated: false,
      error: message,
    });
  }
}

