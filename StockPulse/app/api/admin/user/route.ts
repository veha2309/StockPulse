import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
  try {
    const { email, emails } = await request.json();
    
    if (emails && Array.isArray(emails)) {
      if (emails.length === 0) return NextResponse.json({ error: "No emails provided" }, { status: 400 });
      const { error } = await supabase.from('users').delete().in('email', emails);
      if (error) throw error;
      return NextResponse.json({ success: true, deletedCount: emails.length });
    }

    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const { error } = await supabase.from('users').delete().eq('email', email);
    
    if (error) {
      return NextResponse.json({ error: "User not found or delete failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
