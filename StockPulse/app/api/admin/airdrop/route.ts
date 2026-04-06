import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { amount, password } = await request.json();
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Since we don't have a direct "increment everywhere" RPC in standard Supabase without creating one,
    // we can either fetch all users and update them in parallel, or if it's Supabase we could call a SQL function.
    // For safety and compatibility with the current users table schema, we'll fetch all users, then update.
    const { data: users, error: fetchErr } = await supabase.from('users').select('email, etokens, e_tokens');
    if (fetchErr) throw fetchErr;

    // Update each user
    const promises = (users || []).map(u => {
      const current = u.etokens ?? u.e_tokens ?? 0;
      return supabase
        .from('users')
        .update({ etokens: current + amount, e_tokens: current + amount })
        .eq('email', u.email);
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: users?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
