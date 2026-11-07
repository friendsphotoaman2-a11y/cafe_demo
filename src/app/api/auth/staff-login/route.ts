import { NextRequest, NextResponse } from "next/server";
import {
  StaffRole,
  STAFF_CREDENTIALS,
  createStaffSessionToken,
} from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, pin } = body as { role: StaffRole; pin: string };

    if (!role || !STAFF_CREDENTIALS[role]) {
      return NextResponse.json(
        { error: "Invalid staff role requested." },
        { status: 400 }
      );
    }

    const expectedProfile = STAFF_CREDENTIALS[role];

    // Verify PIN server-side
    if (!pin || pin.trim() !== expectedProfile.defaultPin) {
      return NextResponse.json(
        { error: "Incorrect PIN for this staff role." },
        { status: 401 }
      );
    }

    // Generate signed cryptographic server token
    const token = createStaffSessionToken({
      role,
      email: expectedProfile.email,
      fullName: expectedProfile.name,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: `staff-${role}`,
        email: expectedProfile.email,
        fullName: expectedProfile.name,
        role,
        isAuthenticated: true,
        authMethod: "staff_session",
      },
    });

    // Set HTTP-only secure cookie
    response.cookies.set("tbw_staff_session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

