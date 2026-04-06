import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('*')
    .eq('email', email)
    .order('timestamp', { ascending: false })
    .limit(100);

  const { data: optionTrades, error: optsError } = await supabase
    .from('option_trades')
    .select('*')
    .eq('email', email)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (tradesError) console.error(tradesError);
  if (optsError) console.error(optsError);

  return NextResponse.json({ 
    trades: trades || [], 
    optionTrades: optionTrades || [] 
  });
}
