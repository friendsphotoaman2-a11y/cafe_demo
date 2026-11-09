import { NextResponse } from "next/server";
import { getCookiePath } from "@/lib/base-path";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete({ name: "tbw_staff_session_token", path: getCookiePath() });
  return response;
}

