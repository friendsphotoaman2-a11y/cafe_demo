import crypto from "crypto";

export function generateDiningSessionToken(): string {
  return `ses_${crypto.randomBytes(20).toString("hex")}`;
}

export function generateCustomerSessionToken(): string {
  return `cust_${crypto.randomBytes(24).toString("hex")}`;
}

