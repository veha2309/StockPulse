import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { requestSession } from "@/lib/session";
import { databaseError } from "@/lib/database";
export async function GET(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  const { data, error } = await supabase.rpc("stockpulse_admin_stats");
  if (error) return databaseError(error);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
