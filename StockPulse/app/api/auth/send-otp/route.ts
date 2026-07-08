import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendOtpEmail } from '@/lib/nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Check if email is already registered in the users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 400 });
    }

    // Delete any existing/expired OTPs for this email to prevent DB bloat
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', email);

    // 2. Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Set expiration timestamp to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 4. Save the OTP record into Supabase email_otps table
    const { error: dbError } = await supabase
      .from('email_otps')
      .insert({
        email,
        otp,
        expires_at: expiresAt,
        verified: false,
      });

    if (dbError) {
      console.error('Database error inserting OTP:', dbError);
      return NextResponse.json({ error: 'Failed to generate verification code' }, { status: 500 });
    }

    // 5. Send verification email via Nodemailer
    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error('Nodemailer SMTP error:', emailError);
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Verification code sent successfully' });
  } catch (err: any) {
    console.error('Send OTP route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
