import { NextResponse } from "next/server";
import { requestSession } from "@/lib/session";
import { supabase } from "@/lib/server-db";
import { databaseError } from "@/lib/database";

export async function POST(request: Request) {
  const session = requestSession(request);
  if (!session)
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  try {
    const { requestedAmount, description } = await request.json();
    if (
      !Number.isSafeInteger(requestedAmount) ||
      requestedAmount < 10000 ||
      requestedAmount > 100000000 ||
      (description != null &&
        (typeof description !== "string" || description.length > 1000))
    )
      return NextResponse.json(
        { error: "Request between 10,000 and 100,000,000 virtual funds" },
        { status: 400 },
      );
    const { data: user, error } = await supabase
      .from("users")
      .select("name")
      .eq("email", session.email)
      .maybeSingle();
    if (error) return databaseError(error);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    const { error: insertError } = await supabase
      .from("recharge_requests")
      .insert({
        user_email: session.email,
        user_name: user.name,
        requested_amount: requestedAmount,
        description: description || null,
        status: "pending",
      });
    if (insertError) return databaseError(insertError);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid recharge request" },
      { status: 400 },
    );
  }
}
export async function GET() {
  const { error } = await supabase
    .from("recharge_requests")
    .select("id", { head: true, count: "exact" });
  return NextResponse.json({ ready: !error }, { status: error ? 503 : 200 });
}
