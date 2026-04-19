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

function toYahooSymbol(symbol: string): string {
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ".NS";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ".BO";
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

/** Fetch with automatic failover: query1 → query2 */
async function fetchWithFailsafe(path: string): Promise<any> {
    try {
      return await fetchURL(`https://query1.finance.yahoo.com${path}`);
    } catch (err) {
      console.warn(`[quotes api] query1 failed, trying query2:`, (err as Error).message);
      try {
        return await fetchURL(`https://query2.finance.yahoo.com${path}`);
      } catch (err2) {
        console.warn(`[quotes api] query2 also failed.`);
        throw err2;
      }
    }
}

async function fetchFromGoogleFinance(originalSymbol: string): Promise<number | null> {
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
      const match = html.match(/data-last-price="([0-9.]+)"/) || html.match(/itemprop="price" content="([0-9.]+)"/);
      return match ? parseFloat(match[1]) : null;
    } catch (e) {
      return null;
    }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) return NextResponse.json({ error: "No symbols provided" }, { status: 400 });

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0) return NextResponse.json({});

  // Map to Yahoo Finance symbols
  const yfSymbols = symbols.map(toYahooSymbol);
  
  try {
    // Fetch quotes data from Yahoo Finance Spark endpoint with failsafe
    const encodedSymbols = yfSymbols.map(s => encodeURIComponent(s)).join(',');
    const json = await fetchWithFailsafe(`/v7/finance/spark?symbols=${encodedSymbols}`);
    
    const results = json?.spark?.result || [];
    
    // Create mapping { "NSE:RELIANCE": 2500 }
    const mappedPrices: Record<string, number> = {};
    
    const recoveryNeeded: string[] = [];
    
    symbols.forEach((originalSymbol, index) => {
        const yfSym = yfSymbols[index];
        const quoteObj = results.find((r: any) => r.symbol === yfSym);
        
        const price = quoteObj?.response?.[0]?.meta?.regularMarketPrice;
        if (price) {
            mappedPrices[originalSymbol] = price;
        } else {
            recoveryNeeded.push(originalSymbol);
        }
    });

    // TERTIARY FALLBACK: Recover missing symbols from Google Finance
    if (recoveryNeeded.length > 0) {
        console.warn(`[quotes api] Attempting Google Finance recovery for: ${recoveryNeeded.join(', ')}`);
        const recoveries = await Promise.all(
            recoveryNeeded.map(async (s) => ({ symbol: s, price: await fetchFromGoogleFinance(s) }))
        );
        recoveries.forEach(r => {
            if (r.price) mappedPrices[r.symbol] = r.price;
        });
    }

    return NextResponse.json(mappedPrices);
  } catch (err) {
    console.error("[quotes api] Both query1 and query2 failed:", err);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
