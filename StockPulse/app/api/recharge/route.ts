import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, name, requestedAmount, description } = await request.json();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!requestedAmount || requestedAmount < 10000) {
      return NextResponse.json({ error: 'Minimum recharge is 10,000 VT' }, { status: 400 });
    }

    const { error } = await supabase
      .from('recharge_requests')
      .insert({
        user_email: email,
        user_name: name || null,
        requested_amount: requestedAmount,
        description: description || null,
        status: 'pending',
      });

    if (error) {
      console.error('Recharge insert error:', error);

      // Detect missing table (schema not set up yet)
      if (error.code === 'PGRST205' || error.message?.includes('recharge_requests')) {
        return NextResponse.json({
          error: 'SCHEMA_MISSING',
          message: 'The recharge table has not been created yet. Please run schema_recharge.sql in your Supabase SQL Editor.',
        }, { status: 503 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  // Health check — also validates table existence
  const { error } = await supabase
    .from('recharge_requests')
    .select('id', { count: 'exact', head: true });

  if (error?.code === 'PGRST205' || error?.message?.includes('recharge_requests')) {
    return NextResponse.json({ ready: false, reason: 'SCHEMA_MISSING' });
  }
  return NextResponse.json({ ready: true });
}
