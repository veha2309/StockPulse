import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";
import { safeUser } from "@/lib/user";
import { hashOtp } from "@/lib/session";
import { normalizeEmail, validEmail, sessionResponse } from "@/lib/server-auth";
import { databaseError, rateLimit } from "@/lib/database";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    if (
      !validEmail(email) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 100 ||
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password) > 72 ||
      typeof body.otp !== "string" ||
      !/^\d{6}$/.test(body.otp)
    )
      return NextResponse.json(
        {
          error:
            "Provide a name, valid email, 8–72 byte password and 6-digit code",
        },
        { status: 400 },
      );
    const limited = await rateLimit("verify-otp", email, 10, 600);
    if (limited) return limited;
    const { data: user, error } = await supabase.rpc("stockpulse_register", {
      p_email: email,
      p_name: body.name.trim(),
      p_password: await bcrypt.hash(body.password, 12),
      p_otp: hashOtp(email, body.otp),
    });
    if (error?.message.includes("INVALID_OTP"))
      return NextResponse.json(
        { error: "Verification code is invalid or expired" },
        { status: 400 },
      );
    if (error?.code === "23505")
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 409 },
      );
    if (error) return databaseError(error);
    return sessionResponse(
      { success: true, user: safeUser(user) },
      "user",
      user.email,
    );
  } catch (error) {
    console.error("[verify otp]", error);
    return NextResponse.json(
      { error: "Unable to verify registration" },
      { status: 400 },
    );
  }
}
