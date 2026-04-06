import { NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

/** Convert any NSE:TICKER → TICKER.NS, BSE:TICKER → TICKER.BO, or pass through */
function toYahooSymbol(symbol: string): string {
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ".NS";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ".BO";
  // Already a Yahoo symbol (e.g. "RELIANCE.NS") or unknown — pass through
  return symbol;
}

function fetchURL(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    }).on("error", reject);
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  const yfSymbol = toYahooSymbol(symbol);

  try {
    const [quoteJson, chartJson] = await Promise.all([
      fetchURL(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1d&range=1d`),
      fetchURL(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=5m&range=1d`),
    ]);

    const meta  = quoteJson?.chart?.result?.[0]?.meta ?? {};
    const quote = {
      c:  meta.regularMarketPrice ?? 0,
      pc: meta.previousClose ?? meta.chartPreviousClose ?? 0,
      o:  meta.regularMarketOpen ?? 0,
      h:  meta.regularMarketDayHigh ?? 0,
      l:  meta.regularMarketDayLow ?? 0,
      d:  (meta.regularMarketPrice ?? 0) - (meta.previousClose ?? meta.chartPreviousClose ?? 0),
      dp: meta.previousClose ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100 : 0,
    };

    const result     = chartJson?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const ohlc       = result?.indicators?.quote?.[0] ?? {};

    const chartData = timestamps
      .map((t: number, i: number) => ({ time: new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }), price: ohlc.close?.[i] }))
      .filter((p: any) => p.price != null);

    const candleData = timestamps
      .map((t: number, i: number) => ({ time: t, open: ohlc.open?.[i], high: ohlc.high?.[i], low: ohlc.low?.[i], close: ohlc.close?.[i] }))
      .filter((c: any) => c.open != null && c.close != null);

    return NextResponse.json({ quote, chartData, candleData });
  } catch (err) {
    console.error("[stock api]", err);
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
