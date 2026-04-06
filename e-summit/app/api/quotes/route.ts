import { NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

function toYahooSymbol(symbol: string): string {
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ".NS";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ".BO";
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
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) return NextResponse.json({ error: "No symbols provided" }, { status: 400 });

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0) return NextResponse.json({});

  // Map to Yahoo Finance symbols
  const yfSymbols = symbols.map(toYahooSymbol);
  
  try {
    // Fetch quotes data from Yahoo Finance Spark endpoint (bypasses cookie requirements)
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${yfSymbols.join(',')}`;
    const json = await fetchURL(url);
    
    const results = json?.spark?.result || [];
    
    // Create mapping { "NSE:RELIANCE": 2500 }
    const mappedPrices: Record<string, number> = {};
    
    symbols.forEach((originalSymbol, index) => {
        const yfSym = yfSymbols[index];
        const quoteObj = results.find((r: any) => r.symbol === yfSym);
        
        const price = quoteObj?.response?.[0]?.meta?.regularMarketPrice;
        if (price) {
            mappedPrices[originalSymbol] = price;
        }
    });

    return NextResponse.json(mappedPrices);
  } catch (err) {
    console.error("[quotes api]", err);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
