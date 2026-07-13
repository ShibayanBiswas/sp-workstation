import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNseMarketStatus } from "@/lib/market-hours";
import { INDIAN_MARKET_INDICES, sortByDisplayOrder } from "@/data/indian-markets";
import {
  closesFromOhlc,
  fetchYahooLiveQuote,
  fetchYahooOhlc,
  mapPool,
} from "@/lib/yahoo-ohlc";
import { sparklineSeries } from "@/lib/sparkline";
import { getTimeframe } from "@/lib/chart-timeframes";

export const dynamic = "force-dynamic";

export type MarketQuote = {
  id: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: number[];
  group: string;
};

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    const live = await fetchYahooLiveQuote(index.yahoo);
    if (!live) return null;

    let sparkline: number[] = [];
    const ohlc = await fetchYahooOhlc(index.yahoo, getTimeframe("1M"));
    if (ohlc?.bars.length) {
      sparkline = sparklineSeries(closesFromOhlc(ohlc.bars, 24));
    } else {
      sparkline = sparklineSeries([live.previousClose, live.price]);
    }

    return {
      id: index.id,
      name: index.name,
      price: live.price,
      change: live.change,
      changePercent: live.changePercent,
      sparkline,
      group: index.group,
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

  const results = await mapPool(INDIAN_MARKET_INDICES, yahooQuote, 4);

  const seen = new Set<string>();
  const quotes = sortByDisplayOrder(
    (results.filter(Boolean) as MarketQuote[]).filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
  );

  return NextResponse.json({
    quotes:
      quotes.length > 0
        ? quotes
        : sortByDisplayOrder(
            INDIAN_MARKET_INDICES.map((index) => ({
              id: index.id,
              name: index.name,
              price: null,
              change: null,
              changePercent: null,
              sparkline: [],
              group: index.group,
            }))
          ),
    marketStatus: getNseMarketStatus(),
    asOf: new Date().toISOString(),
  });
}
