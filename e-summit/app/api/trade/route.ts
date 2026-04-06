import { NextResponse } from 'next/server';
import { supabase, safeUser } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Fetch the latest user state to perform the trade
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', body.email)
      .maybeSingle();

    if (userError || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date().toISOString();

    if (body.tradeType === "equity" || !body.tradeType) {
      const { action, symbol, amount, price } = body;
      if (!action || !symbol || !amount || amount <= 0 || !price) {
        return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
      }

      const total = parseFloat((amount * price).toFixed(2));
      let currentTokens = Number(user.etokens ?? user.e_tokens ?? 0);
      let portfolio: any[] = user.portfolio || [];

      if (action === "buy") {
        if (currentTokens < total) return NextResponse.json({ error: "Insufficient E-Tokens" }, { status: 400 });
        currentTokens = parseFloat((currentTokens - total).toFixed(2));
        
        const holding = portfolio.find(p => p.symbol === symbol);
        if (holding) {
          const prevTotal = holding.avgBuyPrice * holding.amount;
          holding.amount += amount;
          holding.avgBuyPrice = parseFloat(((prevTotal + price * amount) / holding.amount).toFixed(4));
        } else {
          portfolio.push({ symbol, amount, avgBuyPrice: price });
        }
      } else if (action === "sell") {
        const holding = portfolio.find(p => p.symbol === symbol);
        if (!holding || holding.amount < amount) {
          return NextResponse.json({ error: "Insufficient shares to sell" }, { status: 400 });
        }
        currentTokens = parseFloat((currentTokens + total).toFixed(2));
        holding.amount -= amount;
        if (holding.amount === 0) {
          portfolio = portfolio.filter(p => p.symbol !== symbol);
        }
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      // Update user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ etokens: currentTokens, e_tokens: currentTokens, portfolio })
        .eq('email', user.email)
        .select()
        .single();

      if (updateError) throw updateError;

      // Insert trade record
      const { error: insertErr } = await supabase.from('trades').insert({
        _id: Date.now().toString(),
        email: user.email,
        action,
        symbol,
        amount,
        price,
        total,
        timestamp: now
      });

      if (insertErr) throw insertErr;

      return NextResponse.json({ user: safeUser(updatedUser) });
    }

    if (body.tradeType === "option") {
      const { action, contractSymbol, underlyingSymbol, optionType, strike, expiration, lots, premium } = body;
      if (!action || !contractSymbol || !lots || lots <= 0 || !premium) {
        return NextResponse.json({ error: "Missing or invalid option fields" }, { status: 400 });
      }

      const total = parseFloat((lots * premium).toFixed(2));
      let currentTokens = Number(user.etokens ?? user.e_tokens ?? 0);
      let options: any[] = user.options || [];

      if (action === "buy") {
        if (currentTokens < total) return NextResponse.json({ error: "Insufficient E-Tokens" }, { status: 400 });
        currentTokens = parseFloat((currentTokens - total).toFixed(2));
        options.push({
          id: Date.now().toString(),
          contractSymbol, underlyingSymbol, type: optionType, strike, expiration, lots, premium, side: "buy", timestamp: now
        });
      } else if (action === "sell") {
        const pos = options.find(o => o.contractSymbol === contractSymbol && o.side === "buy");
        if (!pos || pos.lots < lots) return NextResponse.json({ error: "Insufficient option lots to sell" }, { status: 400 });
        currentTokens = parseFloat((currentTokens + total).toFixed(2));
        pos.lots -= lots;
        if (pos.lots === 0) {
          options = options.filter(o => o.id !== pos.id);
        }
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ etokens: currentTokens, e_tokens: currentTokens, options })
        .eq('email', user.email)
        .select()
        .single();
      
      if (updateError) throw updateError;

      const { error: optInsertErr } = await supabase.from('option_trades').insert({
        _id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000),
        email: user.email,
        action,
        contractSymbol,
        underlyingSymbol,
        optionType,
        strike,
        expiration,
        lots,
        premium,
        total,
        timestamp: now
      });

      if (optInsertErr) throw optInsertErr;

      return NextResponse.json({ user: safeUser(updatedUser) });
    }

    return NextResponse.json({ error: "Invalid tradeType" }, { status: 400 });
  } catch (error) {
    console.error("[trade api]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
