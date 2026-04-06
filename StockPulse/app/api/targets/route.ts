import { NextResponse } from 'next/server';
import { supabase, safeUser } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, symbol, sl, tp } = await request.json();

    if (!email || !symbol) {
      return NextResponse.json({ error: "Missing email or symbol" }, { status: 400 });
    }

    // Fetch user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const portfolio: any[] = user.portfolio || [];
    const itemIndex = portfolio.findIndex(p => p.symbol === symbol);

    if (itemIndex === -1) {
      return NextResponse.json({ error: "You don't hold this asset" }, { status: 400 });
    }

    // Assign targets
    if (sl !== undefined && sl !== null) portfolio[itemIndex].sl = sl;
    else delete portfolio[itemIndex].sl;

    if (tp !== undefined && tp !== null) portfolio[itemIndex].tp = tp;
    else delete portfolio[itemIndex].tp;

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ portfolio })
      .eq('email', email)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ user: safeUser(updatedUser) });
  } catch (error: any) {
    console.error("[targets api]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
