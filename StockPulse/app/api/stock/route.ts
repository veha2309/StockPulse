import { NextResponse } from "next/server";
import { yahooChart } from "@/lib/market-data";
import { validSymbol, positiveNumber } from "@/lib/trading";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol");
  if (!validSymbol(symbol))
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  try {
    const [daily, history] = await Promise.allSettled([
      yahooChart(symbol, "1d"),
      yahooChart(symbol, "5m"),
    ]);
    const result = history.status === "fulfilled" ? history.value : null;
    const meta = daily.status === "fulfilled" ? daily.value.meta : result?.meta;
    if (!meta || !positiveNumber(meta.regularMarketPrice))
      throw new Error("No valid price");
    const c = meta.regularMarketPrice;
    const pc = positiveNumber(meta.chartPreviousClose)
      ? meta.chartPreviousClose
      : positiveNumber(meta.previousClose)
        ? meta.previousClose
        : null;
    const ohlc = result?.indicators?.quote?.[0];
    const candles: {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }[] = [];
    for (let i = 0; i < (result?.timestamp?.length || 0); i++) {
      const time = result.timestamp[i];
      const open = ohlc?.open?.[i],
        high = ohlc?.high?.[i],
        low = ohlc?.low?.[i],
        close = ohlc?.close?.[i];
      if (
        positiveNumber(time) &&
        [open, high, low, close].every(positiveNumber) &&
        high >= Math.max(open, close) &&
        low <= Math.min(open, close)
      )
        candles.push({ time, open, high, low, close });
    }
    const unique = Array.from(
      new Map(candles.map((c) => [c.time, c])).values(),
    ).sort((a, b) => a.time - b.time);
    return NextResponse.json(
      {
        quote: {
          c,
          pc: pc ?? c,
          o: meta.regularMarketOpen ?? c,
          h: meta.regularMarketDayHigh ?? c,
          l: meta.regularMarketDayLow ?? c,
          d: pc === null ? 0 : c - pc,
          dp: pc === null ? 0 : ((c - pc) / pc) * 100,
        },
        chartData: unique.map((c) => ({
          time: new Date(c.time * 1000).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          }),
          price: c.close,
        })),
        candleData: unique,
        source: "yahoo",
        asOf: meta.regularMarketTime || null,
        changeAvailable: pc !== null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Market data is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
