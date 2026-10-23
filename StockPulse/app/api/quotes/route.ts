import { NextResponse } from "next/server";
import { executionPrice } from "@/lib/market-data";
import { validSymbol } from "@/lib/trading";
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols");
  const symbols = [...new Set((raw || "").split(",").filter(Boolean))];
  if (!symbols.length || symbols.length > 75 || !symbols.every(validSymbol))
    return NextResponse.json(
      { error: "Provide 1–75 valid symbols" },
      { status: 400 },
    );
  const quotes = await Promise.allSettled(
    symbols.map(async (symbol) => ({
      symbol,
      price: await executionPrice(symbol),
    })),
  );
  const prices: Record<string, number> = {};
  for (const quote of quotes)
    if (quote.status === "fulfilled")
      prices[quote.value.symbol] = quote.value.price;
  if (!Object.keys(prices).length)
    return NextResponse.json(
      { error: "Quotes are unavailable" },
      { status: 503 },
    );
  return NextResponse.json(prices, {
    headers: { "Cache-Control": "no-store" },
  });
}
