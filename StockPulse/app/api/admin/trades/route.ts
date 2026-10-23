import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";

export const revalidate = 0;

export async function GET(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  const { data: trades, error: txError } = await supabase
    .from("trades")
    .select("*")
    .order("timestamp", { ascending: false });
  const { data: optionTrades, error: optError } = await supabase
    .from("option_trades")
    .select("*")
    .order("timestamp", { ascending: false });

  return NextResponse.json({
    trades: trades || [],
    optionTrades: optionTrades || [],
    error: txError?.message || optError?.message || null,
  });
}

export async function DELETE(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { tradeIds, optionTradeIds } = await request.json();

    if (tradeIds && Array.isArray(tradeIds) && tradeIds.length > 0) {
      const { error } = await supabase
        .from("trades")
        .delete()
        .in("_id", tradeIds);
      if (error) throw error;
    }

    if (
      optionTradeIds &&
      Array.isArray(optionTradeIds) &&
      optionTradeIds.length > 0
    ) {
      const { error } = await supabase
        .from("option_trades")
        .delete()
        .in("_id", optionTradeIds);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Unable to complete request" },
      { status: 500 },
    );
  }
}
