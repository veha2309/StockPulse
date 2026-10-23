import { rateLimit } from "@/lib/database";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { safeUser } from "@/lib/user";
import { requestSession } from "@/lib/session";
import {
  normalizeEmail,
  validEmail,
  sessionResponse,
  logoutResponse,
} from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const session = requestSession(request);
  if (!session)
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  const [userRes, favsRes] = await Promise.all([
    supabase.from("users").select("*").eq("email", session.email).maybeSingle(),
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "global_favorites")
      .maybeSingle(),
  ]);
  if (userRes.error)
    return NextResponse.json(
      { error: "Unable to verify session" },
      { status: 503 },
    );
  if (!userRes.data)
    return NextResponse.json(
      { error: "User not found", loggedOut: true },
      { status: 401 },
    );
  return NextResponse.json(
    {
      user: safeUser(userRes.data),
      globalFavorites: favsRes.data?.value ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  return logoutResponse("user");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    if (body.action === "register")
      return NextResponse.json(
        { error: "Verify your email using the registration form" },
        { status: 400 },
      );
    if (body.action === "login") {
      if (
        !validEmail(email) ||
        typeof body.password !== "string" ||
        body.password.length > 72
      )
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 400 },
        );
      const limited = await rateLimit("user-login", email, 15, 900);
      if (limited) return limited;
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error)
        return NextResponse.json(
          { error: "Sign-in is temporarily unavailable" },
          { status: 503 },
        );
      if (!user || !(await bcrypt.compare(body.password, user.password)))
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 },
        );
      return sessionResponse(
        { success: true, user: safeUser(user) },
        "user",
        user.email,
      );
    }
    if (body.action === "update") {
      const session = requestSession(request);
      if (!session || (email && email !== session.email))
        return NextResponse.json(
          { error: "Sign-in required" },
          { status: 401 },
        );
      if (
        typeof body.currentPassword !== "string" ||
        !body.currentPassword ||
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 100
      )
        return NextResponse.json(
          { error: "Name and current password are required" },
          { status: 400 },
        );
      if (
        body.newPassword &&
        (typeof body.newPassword !== "string" ||
          body.newPassword.length < 8 ||
          Buffer.byteLength(body.newPassword) > 72)
      )
        return NextResponse.json(
          { error: "New password must be 8–72 bytes" },
          { status: 400 },
        );
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", session.email)
        .maybeSingle();
      if (error)
        return NextResponse.json(
          { error: "Account is temporarily unavailable" },
          { status: 503 },
        );
      if (!user)
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (!(await bcrypt.compare(body.currentPassword, user.password)))
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 },
        );
      const updates: { name: string; password?: string } = {
        name: body.name.trim(),
      };
      if (body.newPassword)
        updates.password = await bcrypt.hash(body.newPassword, 12);
      const { data, error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("email", session.email)
        .select()
        .single();
      if (updateError) throw updateError;
      return sessionResponse(
        { success: true, user: safeUser(data) },
        "user",
        session.email,
      );
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[auth api]", error);
    return NextResponse.json(
      { error: "Unable to process authentication request" },
      { status: 500 },
    );
  }
}
