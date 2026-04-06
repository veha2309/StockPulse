import { NextResponse } from 'next/server';
import https from 'https';

function fetchURL(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
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
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Yahoo Finance autocomplete/search — filter to NSE (exchange=NSI)
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=0&enableFuzzyQuery=true&quotesCount=20`;
    const json = await fetchURL(url);

    const quotes: any[] = json?.quotes ?? [];

    // Only NSE equity stocks
    const results = quotes
      .filter((q: any) =>
        q.exchange === "NSI" &&
        q.quoteType === "EQUITY" &&
        q.symbol?.endsWith(".NS")
      )
      .map((q: any) => ({
        name:   q.longname || q.shortname || q.symbol.replace(".NS", ""),
        symbol: `NSE:${q.symbol.replace(".NS", "")}`,
        sector: q.sector || "—",
        yfSymbol: q.symbol,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[stocks/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
