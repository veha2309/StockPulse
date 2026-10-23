import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";

export async function POST(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { email, amount } = await request.json();

    if (!email)
      return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const newAmount = amount ?? 10000;
    if (
      typeof newAmount !== "number" ||
      !Number.isFinite(newAmount) ||
      newAmount < 0 ||
      newAmount > 100000000
    )
      return NextResponse.json({ error: "Invalid balance" }, { status: 400 });

    const { data: user, error: updateError } = await supabase
      .from("users")
      .update({ etokens: newAmount, e_tokens: newAmount })
      .eq("email", email)
      .select()
      .single();

    if (updateError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, eTokens: newAmount });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
