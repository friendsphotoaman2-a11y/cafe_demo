import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

export const COOKIE_CUSTOMER_DEVICE = "tbw_customer_device_token";
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days

export function generateDiningSessionToken(): string {
  return `ses_${crypto.randomBytes(20).toString("hex")}`;
}

export function generateCustomerSessionToken(): string {
  return `cust_${crypto.randomBytes(24).toString("hex")}`;
}

export function generateCustomerDeviceToken(): string {
  return `cdt_${crypto.randomBytes(32).toString("hex")}`;
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface RememberedCustomer {
  id: string;
  fullName: string;
  phone: string;
  stamps?: number;
  totalVisits?: number;
}

/**
 * Creates and stores a new hashed customer device session in Supabase with 90-day expiry.
 */
export async function createAndStoreCustomerDeviceSession(
  supabase: SupabaseClient,
  customerId: string
): Promise<string> {
  const rawToken = generateCustomerDeviceToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(
    Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000
  ).toISOString();

  await supabase.from("customer_sessions").insert({
    customer_id: customerId,
    session_token: tokenHash,
    expires_at: expiresAt,
  });

  return rawToken;
}

/**
 * Validates a raw device token against stored SHA-256 hashes in Supabase.
 * Returns customer profile if valid and non-expired.
 */
export async function verifyCustomerDeviceSession(
  supabase: SupabaseClient,
  rawToken: string
): Promise<{ valid: boolean; customer?: RememberedCustomer }> {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.startsWith("cdt_")) {
    return { valid: false };
  }

  const tokenHash = hashSessionToken(rawToken);

  const { data: sessionRecord, error } = await supabase
    .from("customer_sessions")
    .select(`
      id,
      expires_at,
      customer_id,
      customers (
        id,
        full_name,
        phone
      )
    `)
    .eq("session_token", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !sessionRecord || !sessionRecord.customers) {
    return { valid: false };
  }

  const customerRecord = Array.isArray(sessionRecord.customers)
    ? sessionRecord.customers[0]
    : sessionRecord.customers;

  // Retrieve optional loyalty stats
  let stamps = 0;
  let totalVisits = 0;
  try {
    const { data: loyalty } = await supabase
      .from("loyalty_accounts")
      .select("stamps_earned, total_visits")
      .eq("customer_id", customerRecord.id)
      .maybeSingle();

    if (loyalty) {
      stamps = loyalty.stamps_earned || 0;
      totalVisits = loyalty.total_visits || 0;
    }
  } catch {
    // Optional fallback
  }

  return {
    valid: true,
    customer: {
      id: customerRecord.id,
      fullName: customerRecord.full_name,
      phone: customerRecord.phone,
      stamps,
      totalVisits,
    },
  };
}

/**
 * Revokes a customer device session.
 */
export async function revokeCustomerDeviceSession(
  supabase: SupabaseClient,
  rawToken: string
): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await supabase.from("customer_sessions").delete().eq("session_token", tokenHash);
}
