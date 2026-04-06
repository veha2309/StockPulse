import { NextResponse } from 'next/server';
import { supabase, safeUser } from '@/lib/supabase';

export const revalidate = 0;

export async function GET() {
  const { data: users } = await supabase.from('users').select('*');
  const { data: trades } = await supabase.from('trades').select('email');
  const { data: opts } = await supabase.from('option_trades').select('email');

  const result = (users || []).map(u => ({
    ...safeUser(u),
    tradeCount: trades?.filter(t => t.email === u.email).length || 0,
    optionTradeCount: opts?.filter(t => t.email === u.email).length || 0,
  }));

  return NextResponse.json(result);
}
