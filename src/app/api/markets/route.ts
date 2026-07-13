import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNseMarketStatus } from "@/lib/market-hours";

type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: number[];
  source: string;
};

async function yahooQuote(
  symbol: string,
  name: string
): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=1mo`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { "User-Agent": "Mozilla/5.0 SP-Workstation" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const closes: number[] =
      result?.indicators?.quote?.[0]?.close?.filter(
        (v: number | null) => v != null
      ) ?? [];
    const sparkline = closes.slice(-20);

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
      sparkline,
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

  const [nifty, sensex, bankNifty, indiaVix, usdInr, gold] = await Promise.all([
    yahooQuote("^NSEI", "Nifty 50"),
    yahooQuote("^BSESN", "Sensex"),
    yahooQuote("^NSEBANK", "Bank Nifty"),
    yahooQuote("^INDIAVIX", "India VIX"),
    yahooQuote("INR=X", "USD/INR"),
    yahooQuote("GC=F", "Gold (COMEX)"),
  ]);

  const quotes = [nifty, sensex, bankNifty, indiaVix, usdInr, gold].filter(
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
              sparkline: [],
              source: "unavailable",
            },
            {
              symbol: "^BSESN",
              name: "Sensex",
              price: null,
              change: null,
              changePercent: null,
              sparkline: [],
              source: "unavailable",
            },
          ],
    marketStatus: getNseMarketStatus(),
    asOf: new Date().toISOString(),
  });
}
