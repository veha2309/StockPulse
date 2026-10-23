import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { databaseError } from "@/lib/database";
export async function GET(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  const { data, error } = await supabase
    .from("recharge_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return databaseError(error);
  return NextResponse.json(data ?? []);
}
export async function PATCH(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { id, status, adminNote } = await request.json();
    if (
      typeof id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(id) ||
      !["approved", "rejected"].includes(status) ||
      (adminNote != null &&
        (typeof adminNote !== "string" || adminNote.length > 1000))
    )
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { error } = await supabase.rpc("stockpulse_resolve_recharge", {
      p_id: id,
      p_status: status,
      p_note: adminNote || null,
    });
    if (error?.message === "ALREADY_RESOLVED")
      return NextResponse.json(
        { error: "Request already resolved" },
        { status: 409 },
      );
    if (
      error?.message === "REQUEST_NOT_FOUND" ||
      error?.message === "USER_NOT_FOUND"
    )
      return NextResponse.json(
        { error: "Request or user not found" },
        { status: 404 },
      );
    if (error) return databaseError(error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
