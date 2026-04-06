import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 0;

export async function GET() {
  const { data: trades, error: txError } = await supabase.from('trades').select('*').order('timestamp', { ascending: false });
  const { data: optionTrades, error: optError } = await supabase.from('option_trades').select('*').order('timestamp', { ascending: false });

  return NextResponse.json({ 
      trades: trades || [], 
      optionTrades: optionTrades || [],
      error: txError?.message || optError?.message || null 
  });
}
