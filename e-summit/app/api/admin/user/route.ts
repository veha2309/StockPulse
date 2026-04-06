import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const { error } = await supabase.from('users').delete().eq('email', email);
    
    if (error) {
      return NextResponse.json({ error: "User not found or delete failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
