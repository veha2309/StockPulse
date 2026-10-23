import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { safeUser } from "@/lib/user";
import { requestSession } from "@/lib/session";
import { validSymbol, positiveNumber } from "@/lib/trading";
import { databaseError } from "@/lib/database";

export async function POST(request: Request) {
  const session = requestSession(request);
  if (!session)
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  try {
    const { email, symbol, sl = null, tp = null } = await request.json();
    if (email && email !== session.email)
      return NextResponse.json({ error: "Account mismatch" }, { status: 403 });
    if (
      !validSymbol(symbol) ||
      (sl !== null && !positiveNumber(sl)) ||
      (tp !== null && !positiveNumber(tp)) ||
      (sl !== null && tp !== null && sl >= tp)
    )
      return NextResponse.json(
        { error: "Targets must be positive, with stop loss below take profit" },
        { status: 400 },
      );
    const { data, error } = await supabase.rpc("stockpulse_set_targets", {
      p_email: session.email,
      p_symbol: symbol,
      p_sl: sl,
      p_tp: tp,
    });
    if (error?.message === "NO_HOLDING")
      return NextResponse.json(
        { error: "You do not hold this asset" },
        { status: 400 },
      );
    if (error) return databaseError(error);
    return NextResponse.json({ user: safeUser(data) });
  } catch {
    return NextResponse.json(
      { error: "Invalid target request" },
      { status: 400 },
    );
  }
}
