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

export async function DELETE(request: Request) {
  try {
    const { tradeIds, optionTradeIds } = await request.json();

    if (tradeIds && Array.isArray(tradeIds) && tradeIds.length > 0) {
      const { error } = await supabase.from('trades').delete().in('_id', tradeIds);
      if (error) throw error;
    }

    if (optionTradeIds && Array.isArray(optionTradeIds) && optionTradeIds.length > 0) {
      const { error } = await supabase.from('option_trades').delete().in('_id', optionTradeIds);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
