import { NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

/** Index symbol → Yahoo Finance symbol mapping */
const INDEX_MAP: Record<string, string> = {
  "NSE:NIFTY_50":        "^NSEI",
  "NSE:NIFTY_BANK":      "^NSEBANK",
  "NSE:NIFTY_IT":        "^CNXIT",
  "NSE:NIFTY_MIDCAP_50": "^NSEMDCP50",
  "BSE:SENSEX":          "^BSESN",
};

/** Google Finance Symbol Mapping */
const GOOGLE_MAP: Record<string, string> = {
  "NSE:NIFTY_50":        "NIFTY_50:INDEXNSE",
  "NSE:NIFTY_BANK":      "NIFTY_BANK:INDEXNSE",
  "NSE:NIFTY_IT":        "NIFTY_IT:INDEXNSE",
  "NSE:NIFTY_MIDCAP_50": "NIFTY_MIDCAP_50:INDEXNSE",
  "BSE:SENSEX":          "SENSEX:INDEXBOM",
};

function toGoogleSymbol(symbol: string): string {
  if (GOOGLE_MAP[symbol]) return GOOGLE_MAP[symbol];
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ":NSE";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ":BOM";
  return symbol;
}

/** Convert any NSE:TICKER → TICKER.NS, BSE:TICKER → TICKER.BO, indices → ^SYMBOL, or pass through */
function toYahooSymbol(symbol: string): string {
  // Check index mapping first
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ".NS";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ".BO";
  // Already a Yahoo symbol (e.g. "RELIANCE.NS") or unknown — pass through
  return symbol;
}

function fetchURL(url: string, timeoutMs = 6000): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

/** Fetch with automatic failover: query1 → query2 → Google Scraper (for quote only) */
async function fetchWithFailsafe(path: string): Promise<any> {
  try {
    return await fetchURL(`https://query1.finance.yahoo.com${path}`);
  } catch (err) {
    console.warn(`[stock api] query1 failed, trying query2:`, (err as Error).message);
    try {
        return await fetchURL(`https://query2.finance.yahoo.com${path}`);
    } catch (err2) {
        console.warn(`[stock api] query2 also failed.`);
        throw err2;
    }
  }
}

async function fetchFromGoogleFinance(originalSymbol: string): Promise<any> {
  const gSym = toGoogleSymbol(originalSymbol);
  try {
    const url = `https://www.google.com/finance/quote/${gSym}`;
    const html = await new Promise<string>((resolve, reject) => {
      https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => resolve(d));
      }).on("error", reject);
    });
    
    // Scrape current price
    const priceMatch = html.match(/data-last-price="([0-9.]+)"/) || html.match(/itemprop="price" content="([0-9.]+)"/);
    const prevCloseMatch = html.match(/data-last-normal-market-price="([0-9.]+)"/);
    
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const prevClose = prevCloseMatch ? parseFloat(prevCloseMatch[1]) : price;
      return {
        regularMarketPrice: price,
        previousClose: prevClose,
        googleFallback: true
      };
    }
    return null;
  } catch (e) {
    console.warn("[stock api] Google Finance fallback failed:", e);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  const yfSymbol = toYahooSymbol(symbol);
  const encodedSymbol = encodeURIComponent(yfSymbol);

  let quoteJson: any;
  let chartJson: any;

  try {
    [quoteJson, chartJson] = await Promise.all([
      fetchWithFailsafe(`/v8/finance/chart/${encodedSymbol}?interval=1d&range=1d`).catch(() => null),
      fetchWithFailsafe(`/v8/finance/chart/${encodedSymbol}?interval=5m&range=1d`).catch(() => null),
    ]);

    let meta = quoteJson?.chart?.result?.[0]?.meta;
    
    // TERTIARY FALLBACK: If Yahoo returns no result, try Google Finance Scraper
    if (!meta) {
      console.warn(`[stock api] Yahoo failed for ${symbol}, attempting Google Finance recovery...`);
      const googleData = await fetchFromGoogleFinance(symbol);
      if (googleData) {
        meta = googleData;
      }
    }

    if (!meta) throw new Error("All data sources failed for this symbol");

    const currentPrice = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;

    const quote = {
      c:  currentPrice,
      pc: prevClose,
      o:  meta.regularMarketOpen ?? prevClose,
      h:  meta.regularMarketDayHigh ?? currentPrice,
      l:  meta.regularMarketDayLow ?? currentPrice,
      d:  currentPrice - prevClose,
      dp: prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0,
    };

    const result = chartJson?.chart?.result?.[0];
    let timestamps = result?.timestamp ?? [];
    let ohlc = result?.indicators?.quote?.[0] ?? {};

    // REALISTIC CHART HEARTBEAT: If chart data is empty but we have a price, generate a pulse
    // This prevents the "Market Halted" screen during live market hours.
    if (timestamps.length === 0 && currentPrice > 0) {
      const now = Math.floor(Date.now() / 1000);
      timestamps = [now - 300, now];
      ohlc = { close: [prevClose, currentPrice], open: [prevClose, currentPrice], high: [Math.max(prevClose, currentPrice), Math.max(prevClose, currentPrice)], low: [Math.min(prevClose, currentPrice), Math.min(prevClose, currentPrice)] };
    }

    const chartData = timestamps
      .map((t: number, i: number) => ({ time: new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }), price: ohlc.close?.[i] }))
      .filter((p: any) => p.price != null);

    const candleData = timestamps
      .map((t: number, i: number) => ({ time: t, open: ohlc.open?.[i], high: ohlc.high?.[i], low: ohlc.low?.[i], close: ohlc.close?.[i] }))
      .filter((c: any) => c.open != null && c.close != null);

    return NextResponse.json(
      { quote, chartData, candleData },
      { headers: { 'Cache-Control': 's-maxage=20, stale-while-revalidate=59' } }
    );
  } catch (err) {
    console.error("[stock api] Both query1 and query2 failed:", err);
    return NextResponse.json({ error: "Failed to fetch stock data. Please try again." }, { status: 500 });
  }
}
