import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const table_code = (body.table_code || body.tableCode || '').trim();
    const pin = (body.pin || body.pin_code || '').trim();

    if (!table_code || !pin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Try verify_table_pin RPC
    let rpcData: Record<string, unknown> | null = null;
    let rpcError: unknown = null;

    const { data: vData, error: vError } = await supabaseAdmin.rpc('verify_table_pin', {
      p_table_code: table_code,
      p_pin: pin,
    });

    if (!vError && vData) {
      rpcData = vData;
    } else {
      // 2. Fallback to join_session RPC if that exists
      const { data: jData, error: jError } = await supabaseAdmin.rpc('join_session', {
        table_code: table_code,
        pin: pin,
      });

      if (!jError && jData) {
        rpcData = jData;
      } else {
        rpcError = vError || jError;
      }
    }

    if (rpcError && !rpcData) {
      console.error('RPC Error verifying table PIN:', rpcError);
      return NextResponse.json({
        success: false,
        message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
      });
    }

    // Standardize error message when PIN/table is invalid
    if (rpcData && !rpcData.success && !rpcData.locked) {
      rpcData.message = 'Invalid PIN. Please talk to the manager and get your PIN again.';
    }

    return NextResponse.json(rpcData);
  } catch (err: unknown) {
    console.error('verify-pin API route error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
      },
      { status: 500 }
    );
  }
}

