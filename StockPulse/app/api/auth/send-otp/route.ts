import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { supabase } from "@/lib/server-db";
import { sendOtpEmail } from "@/lib/nodemailer";
import { normalizeEmail, validEmail } from "@/lib/server-auth";
import { hashOtp } from "@/lib/session";
import { databaseError, rateLimit } from "@/lib/database";

export async function POST(request: Request) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!validEmail(email))
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    const limited = await rateLimit("send-otp", email, 3, 600);
    if (limited) return limited;
    const { data: existing, error } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (error) return databaseError(error);
    if (existing)
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 409 },
      );
    const otp = String(randomInt(100000, 1000000));
    const { data: code, error: dbError } = await supabase
      .from("email_otps")
      .insert({
        email,
        otp: hashOtp(email, otp),
        expires_at: new Date(Date.now() + 600000).toISOString(),
        verified: false,
      })
      .select("id")
      .single();
    if (dbError) return databaseError(dbError);
    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error("[send otp]", emailError);
      await supabase.from("email_otps").delete().eq("id", code.id);
      return NextResponse.json(
        { error: "Unable to send verification email" },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to send verification code" },
      { status: 400 },
    );
  }
}
