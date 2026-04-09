import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// GET — list all recharge requests
export async function GET() {
  const { data, error } = await supabase
    .from('recharge_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH — approve or reject a request
export async function PATCH(request: Request) {
  try {
    const { id, status, adminNote, password } = await request.json();

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Fetch the request first to get email + amount
    const { data: reqRow, error: fetchErr } = await supabase
      .from('recharge_requests')
      .select('user_email, requested_amount, status')
      .eq('id', id)
      .single();

    if (fetchErr || !reqRow) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: 'Request already resolved' }, { status: 409 });
    }

    // Update the request row
    const { error: updateErr } = await supabase
      .from('recharge_requests')
      .update({
        status,
        admin_note: adminNote || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // If approved, credit eTokens to the user
    if (status === 'approved') {
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('etokens, e_tokens')
        .eq('email', reqRow.user_email)
        .single();

      if (userErr) return NextResponse.json({ error: 'User not found: ' + userErr.message }, { status: 404 });

      const current = Number(userRow.etokens ?? userRow.e_tokens ?? 0);
      const newTokens = current + reqRow.requested_amount;
      const { error: tokenErr } = await supabase
        .from('users')
        .update({ etokens: newTokens, e_tokens: newTokens })
        .eq('email', reqRow.user_email);

      if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
