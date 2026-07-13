import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  source: string;
};

async function yahooQuote(
  symbol: string,
  name: string
): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=5d`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { "User-Agent": "Mozilla/5.0 SP-Workstation" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? null;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change =
      price != null && prev != null ? Number(price) - Number(prev) : null;
    const changePercent =
      change != null && prev ? (change / Number(prev)) * 100 : null;
    return {
      symbol,
      name,
      price: price != null ? Number(price) : null,
      change,
      changePercent,
      source: "Yahoo Finance",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [nifty, sensex, bankNifty, indiaVix] = await Promise.all([
    yahooQuote("^NSEI", "Nifty 50"),
    yahooQuote("^BSESN", "Sensex"),
    yahooQuote("^NSEBANK", "Bank Nifty"),
    yahooQuote("^INDIAVIX", "India VIX"),
  ]);

  const quotes = [nifty, sensex, bankNifty, indiaVix].filter(
    Boolean
  ) as Quote[];

  return NextResponse.json({
    quotes:
      quotes.length > 0
        ? quotes
        : [
            {
              symbol: "^NSEI",
              name: "Nifty 50",
              price: null,
              change: null,
              changePercent: null,
              source: "unavailable",
            },
            {
              symbol: "^BSESN",
              name: "Sensex",
              price: null,
              change: null,
              changePercent: null,
              source: "unavailable",
            },
          ],
    asOf: new Date().toISOString(),
  });
}
