import { NextRequest, NextResponse } from 'next/server';
import { resolveTableAccess } from '@/lib/table-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableCode = (searchParams.get('table_code') || '').trim().toUpperCase();
    const sessionId = searchParams.get('session_id') || '';
    const sessionToken = searchParams.get('session_token') || '';

    if (!tableCode) {
      return NextResponse.json(
        { success: false, message: 'table_code is required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const result = await resolveTableAccess(tableCode, { sessionId, sessionToken });

    if (result.access === 'not_found') {
      return NextResponse.json(
        { success: false, access: 'not_found', message: result.message },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (result.access === 'error') {
      return NextResponse.json(
        { success: false, access: 'error', message: result.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error('Table session check error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
