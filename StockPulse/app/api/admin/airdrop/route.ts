import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { databaseError } from "@/lib/database";
export async function POST(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { amount } = await request.json();
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000000
    )
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    const { data, error } = await supabase.rpc("stockpulse_airdrop", {
      p_amount: amount,
    });
    if (error) return databaseError(error);
    return NextResponse.json({ success: true, count: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid airdrop request" },
      { status: 400 },
    );
  }
}
