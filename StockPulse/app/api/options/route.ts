import { NextResponse } from "next/server";
import { executionPrice } from "@/lib/market-data";
import { validSymbol } from "@/lib/trading";
import {
  practiceExpiry,
  expiryLabel,
  optionPremium,
  practiceContract,
} from "@/lib/simulated-options";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  if (!validSymbol(symbol))
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  const now = Date.now(),
    expiration = practiceExpiry(now),
    expiry = expiryLabel(expiration);
  const requestedContract = params.get("contract");
  const requestedStrike = Number(params.get("strike"));
  const requestedExpiration = Number(params.get("expiration"));
  const requestedType = params.get("type");
  if (
    requestedContract &&
    (!(requestedStrike > 0) ||
      !Number.isFinite(requestedStrike) ||
      !Number.isSafeInteger(requestedExpiration) ||
      requestedExpiration * 1000 <= now ||
      (requestedType !== "call" && requestedType !== "put") ||
      requestedContract !==
        practiceContract(
          symbol,
          requestedStrike,
          requestedType,
          requestedExpiration,
        ))
  )
    return NextResponse.json(
      { error: "Invalid or expired practice contract" },
      { status: 400 },
    );
  if (params.get("expiry") && params.get("expiry") !== expiry)
    return NextResponse.json(
      { error: "Practice expiry is no longer available. Refresh the chain." },
      { status: 400 },
    );
  try {
    const spot = await executionPrice(symbol);
    if (requestedContract)
      return NextResponse.json(
        {
          contract: {
            contractSymbol: requestedContract,
            lastPrice: optionPremium(
              spot,
              requestedStrike,
              requestedType as "call" | "put",
              requestedExpiration,
              now,
            ),
          },
          simulated: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const step = spot > 3000 ? 50 : spot > 1000 ? 20 : spot < 200 ? 5 : 10;
    const base = Math.round(spot / step) * step;
    const strikes = Array.from(
      { length: 25 },
      (_, i) => base + (i - 12) * step,
    ).filter((s) => s > 0);
    const chain = (type: "call" | "put") =>
      strikes.map((strike) => {
        const premium = optionPremium(spot, strike, type, expiration, now);
        return {
          contractSymbol: practiceContract(symbol, strike, type, expiration),
          strike,
          expiration,
          lastPrice: premium,
          bid: premium,
          ask: premium,
          change: 0,
          percentChange: 0,
          volume: 0,
          openInterest: 0,
          impliedVolatility: 0,
          inTheMoney: type === "call" ? spot > strike : spot < strike,
        };
      });
    return NextResponse.json(
      {
        underlyingPrice: spot,
        expiryDates: [expiry],
        calls: chain("call"),
        puts: chain("put"),
        marketClosed: false,
        simulated: true,
        asOf: now,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Underlying price is unavailable",
        calls: [],
        puts: [],
        expiryDates: [],
        marketClosed: true,
        simulated: true,
      },
      { status: 503 },
    );
  }
}
