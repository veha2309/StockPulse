import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, amount } = await request.json();
    
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const newAmount = typeof amount === "number" ? amount : 10000;

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ etokens: newAmount, e_tokens: newAmount })
      .eq('email', email)
      .select()
      .single();

    if (updateError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, eTokens: newAmount });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
