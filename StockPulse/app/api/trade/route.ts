import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/server-db";
import { safeUser } from "@/lib/user";
import { requestSession } from "@/lib/session";
import { databaseError } from "@/lib/database";
import {
  applyTrade,
  positiveNumber,
  validSymbol,
  TradeError,
  type TradeInput,
} from "@/lib/trading";
import { executionPrice } from "@/lib/market-data";
import {
  optionPremium,
  practiceContract,
  practiceExpiry,
} from "@/lib/simulated-options";

export async function POST(request: Request) {
  const session = requestSession(request);
  if (!session)
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  try {
    const body = await request.json();
    if (body.email && body.email !== session.email)
      return NextResponse.json({ error: "Account mismatch" }, { status: 403 });
    const tradeType = body.tradeType ?? "equity";
    const symbol = tradeType === "option" ? body.underlyingSymbol : body.symbol;
    const quantity = tradeType === "option" ? body.lots : body.amount;
    if (
      body.orderId !== undefined &&
      (typeof body.orderId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          body.orderId,
        ))
    )
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    const id = body.orderId || randomUUID();
    if (
      !["equity", "option"].includes(tradeType) ||
      !["buy", "sell"].includes(body.action) ||
      !validSymbol(symbol) ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    )
      return NextResponse.json(
        { error: "Provide a valid symbol, action and positive whole quantity" },
        { status: 400 },
      );
    if (
      tradeType === "equity" &&
      body.action === "buy" &&
      [
        "NSE:NIFTY_50",
        "NSE:NIFTY_BANK",
        "NSE:NIFTY_IT",
        "NSE:NIFTY_MIDCAP_50",
        "BSE:SENSEX",
      ].includes(symbol)
    )
      return NextResponse.json(
        {
          error:
            "Indices cannot be bought as shares. Select an equity or explore practice options.",
        },
        { status: 400 },
      );
    let contract: TradeInput["contract"];
    if (tradeType === "option") {
      if (
        !["call", "put"].includes(body.optionType) ||
        !positiveNumber(body.strike) ||
        !Number.isSafeInteger(body.expiration) ||
        body.expiration * 1000 <= Date.now() ||
        body.contractSymbol !==
          practiceContract(
            symbol,
            body.strike,
            body.optionType,
            body.expiration,
          )
      )
        return NextResponse.json(
          { error: "Invalid or expired practice contract" },
          { status: 400 },
        );
      if (body.action === "buy" && body.expiration !== practiceExpiry())
        return NextResponse.json(
          { error: "Refresh the option chain before buying this expiry" },
          { status: 400 },
        );
      contract = {
        contractSymbol: body.contractSymbol,
        underlyingSymbol: symbol,
        type: body.optionType,
        strike: body.strike,
        expiration: body.expiration,
      };
    }
    const receiptResponse = async () => {
      const { data: receipt, error } = await supabase
        .from(tradeType === "equity" ? "trades" : "option_trades")
        .select("*")
        .eq("_id", id)
        .maybeSingle();
      if (error) return databaseError(error);
      if (!receipt) return null;
      if (
        receipt.email !== session.email ||
        receipt.action !== body.action ||
        (tradeType === "equity"
          ? receipt.symbol !== symbol || Number(receipt.amount) !== quantity
          : receipt.contractSymbol !== contract?.contractSymbol ||
            Number(receipt.lots) !== quantity)
      )
        return NextResponse.json(
          { error: "Order id is already used by a different order" },
          { status: 409 },
        );
      const { data: account, error: accountError } = await supabase
        .from("users")
        .select("*")
        .eq("email", session.email)
        .single();
      if (accountError) return databaseError(accountError);
      return NextResponse.json({
        user: safeUser(account),
        executionPrice: Number(receipt.price ?? receipt.premium),
        total: Number(receipt.total),
      });
    };
    const completed = await receiptResponse();
    if (completed) return completed;
    let price: number;
    try {
      const spot = await executionPrice(symbol);
      price = contract
        ? optionPremium(
            spot,
            contract.strike,
            contract.type,
            contract.expiration,
          )
        : spot;
    } catch {
      return NextResponse.json(
        { error: "Market price is unavailable. Order was not placed." },
        { status: 503 },
      );
    }
    const timestamp = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) {
        const completed = await receiptResponse();
        if (completed) return completed;
      }
      const { data: row, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", session.email)
        .maybeSingle();
      if (error) return databaseError(error);
      if (!row)
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      const user = safeUser(row);
      if (body.trigger) {
        const holding = user.portfolio.find((p) => p.symbol === symbol);
        if (
          body.action !== "sell" ||
          tradeType !== "equity" ||
          !holding ||
          holding.amount !== quantity ||
          !(
            (holding.sl && price <= holding.sl) ||
            (holding.tp && price >= holding.tp)
          )
        )
          return NextResponse.json(
            { error: "Target is no longer triggered" },
            { status: 409 },
          );
      }
      const state = applyTrade(
        user,
        {
          action: body.action,
          tradeType,
          symbol,
          quantity,
          price,
          contract,
          positionId: body.positionId,
        },
        id,
        timestamp,
      );
      const trade = contract
        ? {
            _id: id,
            action: body.action,
            ...contract,
            optionType: contract.type,
            lots: quantity,
            premium: price,
            total: state.total,
            timestamp,
          }
        : {
            _id: id,
            action: body.action,
            symbol,
            amount: quantity,
            price,
            total: state.total,
            timestamp,
          };
      const { data: updated, error: commitError } = await supabase.rpc(
        "stockpulse_commit_trade",
        {
          p_email: session.email,
          p_expected: {
            balance: user.eTokens,
            portfolio: user.portfolio,
            options: user.options,
          },
          p_state: state,
          p_kind: tradeType,
          p_trade: trade,
        },
      );
      if (commitError?.message === "CONFLICT") continue;
      if (commitError) return databaseError(commitError);
      return NextResponse.json({
        user: safeUser(updated),
        executionPrice: updated.executionPrice ?? price,
        total: updated.total ?? state.total,
      });
    }
    return NextResponse.json(
      { error: "Account changed during this order. Please try again." },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof TradeError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[trade]", error);
    return NextResponse.json(
      { error: "Unable to process order" },
      { status: 400 },
    );
  }
}
