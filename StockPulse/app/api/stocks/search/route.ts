import { NextResponse } from "next/server";

type SearchQuote = {
  exchange?: string;
  quoteType?: string;
  symbol?: string;
  longname?: string;
  shortname?: string;
  sector?: string;
};
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ results: [] });
  if (query.length > 100)
    return NextResponse.json(
      { error: "Search query is too long" },
      { status: 400 },
    );
  try {
    const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
    url.search = new URLSearchParams({
      q: query,
      newsCount: "0",
      enableFuzzyQuery: "true",
      quotesCount: "20",
    }).toString();
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Search unavailable");
    const data = await response.json();
    const quotes: SearchQuote[] = Array.isArray(data.quotes) ? data.quotes : [];
    const results = quotes
      .filter(
        (q) =>
          q.exchange === "NSI" &&
          q.quoteType === "EQUITY" &&
          q.symbol?.endsWith(".NS"),
      )
      .map((q) => ({
        name: q.longname || q.shortname || q.symbol!.slice(0, -3),
        symbol: "NSE:" + q.symbol!.slice(0, -3),
        sector: q.sector || "—",
      }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Search is temporarily unavailable" },
      { status: 503 },
    );
  }
}
