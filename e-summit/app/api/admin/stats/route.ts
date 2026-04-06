import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 0;

export async function GET() {
  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: totalTrades } = await supabase.from('trades').select('*', { count: 'exact', head: true });
  const { count: totalOptionTrades } = await supabase.from('option_trades').select('*', { count: 'exact', head: true });

  const { data: usersData } = await supabase.from('users').select('eTokens, etokens, e_tokens');
  const totalETokens = usersData?.reduce((s, u) => s + Number(u.eTokens ?? u.etokens ?? u.e_tokens ?? 0), 0) || 0;

  const { data: tradesData } = await supabase.from('trades').select('total');
  const { data: optsData } = await supabase.from('option_trades').select('total');

  const totalVolume = 
    (tradesData?.reduce((s, t) => s + Number(t.total || 0), 0) || 0) +
    (optsData?.reduce((s, t) => s + Number(t.total || 0), 0) || 0);

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    totalTrades: totalTrades || 0,
    totalOptionTrades: totalOptionTrades || 0,
    totalVolume: parseFloat(totalVolume.toFixed(2)),
    totalETokens,
  });
}
