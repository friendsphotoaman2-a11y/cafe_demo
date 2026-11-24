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

    // Call verify_table_pin RPC directly
    const { data: vData, error: vError } = await supabaseAdmin.rpc('verify_table_pin', {
      p_table_code: table_code,
      p_pin: pin,
    });

    if (vError || !vData) {
      console.error('RPC Error verifying table PIN:', vError);
      return NextResponse.json({
        success: false,
        message: 'Invalid PIN. Please talk to the manager and get your PIN again.',
      });
    }

    const rpcData = vData as Record<string, unknown>;

    // Standardize error message when PIN/table is invalid
    if (!rpcData.success && !rpcData.locked) {
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

