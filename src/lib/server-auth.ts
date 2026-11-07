import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "manager" | "cashier" | "kitchen";

export interface AuthenticatedStaff {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  authMethod: "supabase_auth" | "staff_session";
}

export const STAFF_CREDENTIALS: Record<
  StaffRole,
  { name: string; email: string; defaultPin: string }
> = {
  owner: {
    name: "Aman (Café Owner)",
    email: "owner@brewandbean.in",
    defaultPin: "1234",
  },
  manager: {
    name: "Siddharth (Store Manager)",
    email: "manager@brewandbean.in",
    defaultPin: "2345",
  },
  cashier: {
    name: "Rahul (Head Cashier)",
    email: "cashier@brewandbean.in",
    defaultPin: "3456",
  },
  kitchen: {
    name: "Chef Vikram (Lead Barista)",
    email: "kitchen@brewandbean.in",
    defaultPin: "4567",
  },
};

const COOKIE_NAME = "tbw_staff_session_token";

// Derive a server secret for HMAC signing without exposing keys
function getSigningSecret(): string {
  const envSecret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "tbw_cafe_internal_signing_key_v3";
  return crypto.createHash("sha256").update(envSecret).digest("hex");
}

export function createStaffSessionToken(payload: {
  role: StaffRole;
  email: string;
  fullName: string;
}): string {
  const secret = getSigningSecret();
  const data = JSON.stringify({
    ...payload,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
  });
  const dataBase64 = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(dataBase64)
    .digest("base64url");
  return `${dataBase64}.${signature}`;
}

export function verifyStaffSessionToken(
  token: string
): AuthenticatedStaff | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataBase64, signature] = parts;
    const secret = getSigningSecret();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataBase64)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(dataBase64, "base64url").toString("utf8")
    );

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }

    return {
      id: `staff-${payload.role}`,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role as StaffRole,
      authMethod: "staff_session",
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedStaff(
  req: NextRequest
): Promise<AuthenticatedStaff | null> {
  // 1. Check Server Signed Cookie
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const verified = verifyStaffSessionToken(cookieToken);
    if (verified) return verified;
  }

  // 2. Check Authorization Header Bearer token
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7);
    const verified = verifyStaffSessionToken(bearerToken);
    if (verified) return verified;
  }

  // 3. Check Supabase OAuth Session
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && user.email) {
      let role: StaffRole = "owner";
      if (user.email.includes("kitchen")) role = "kitchen";
      else if (user.email.includes("cashier")) role = "cashier";
      else if (user.email.includes("manager")) role = "manager";

      return {
        id: user.id,
        email: user.email,
        fullName:
          user.user_metadata?.full_name || user.email.split("@")[0],
        role,
        authMethod: "supabase_auth",
      };
    }
  } catch {
    // Supabase auth not configured or token expired
  }

  return null;
}

export async function requireStaffRole(
  req: NextRequest,
  allowedRoles: StaffRole[]
): Promise<
  | { authorized: true; staff: AuthenticatedStaff }
  | { authorized: false; error: string; status: number }
> {
  const staff = await getAuthenticatedStaff(req);

  if (!staff) {
    return {
      authorized: false,
      error: "Authentication required. You must log in as staff to perform this action.",
      status: 401,
    };
  }

  // Owner has universal access
  if (staff.role === "owner" || allowedRoles.includes(staff.role)) {
    return { authorized: true, staff };
  }

  return {
    authorized: false,
    error: `Access denied. Role '${staff.role}' is not authorized for this action. Required: ${allowedRoles.join(
      ", "
    )}`,
    status: 403,
  };
}
