import { NextResponse } from 'next/server';
import { supabase, safeUser } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, email, password, otp } = await request.json();

    if (!name || !email || !password || !otp) {
      return NextResponse.json({ error: 'All fields (name, email, password, otp) are required' }, { status: 400 });
    }

    // 1. Query the latest unverified OTP entry for this email and matching OTP code
    const { data: otpRecord, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error('Error fetching OTP record:', otpError);
      return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // 2. Verify that the OTP code is not expired (10 minutes)
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);

    if (now > expiresAt) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // 3. Mark the OTP record as verified
    const { error: updateOtpError } = await supabase
      .from('email_otps')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    if (updateOtpError) {
      console.error('Error updating OTP record:', updateOtpError);
    }

    // 4. Double check that the email is not already registered in users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 400 });
    }

    // 5. Hash the password
    const hashed = await bcrypt.hash(password, 10);

    // 6. Construct and insert the new user record
    const newUser = {
      name,
      email,
      password: hashed,
      etokens: 10000,
      e_tokens: 10000,
      portfolio: [],
      options: []
    };

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting user:', insertError);
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
    }

    // 7. Delete all OTPs for this email since registration succeeded
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', email);

    return NextResponse.json({ success: true, user: safeUser(user) });
  } catch (err: any) {
    console.error('Verify OTP route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
