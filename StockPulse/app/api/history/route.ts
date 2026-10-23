import { NextResponse } from "next/server";
import { requestSession } from "@/lib/session";
import { supabase } from "@/lib/server-db";
import { databaseError } from "@/lib/database";

export async function GET(request: Request) {
  const session = requestSession(request);
  if (!session)
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  const [trades, options] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("email", session.email)
      .order("timestamp", { ascending: false })
      .limit(100),
    supabase
      .from("option_trades")
      .select("*")
      .eq("email", session.email)
      .order("timestamp", { ascending: false })
      .limit(100),
  ]);
  if (trades.error || options.error)
    return databaseError((trades.error || options.error)!);
  return NextResponse.json(
    { trades: trades.data, optionTrades: options.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
