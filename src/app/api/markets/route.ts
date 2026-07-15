import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNseMarketStatus } from "@/lib/market-hours";
import { INDIAN_MARKET_INDICES, sortByDisplayOrder } from "@/data/indian-markets";
import {
  fetchYahooLiveQuote,
  fetchYahooOhlc,
  mapPool,
  sessionClosesForSparkline,
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
  /** Today's session open — same basis as tape / Snapshot / 1D chart. */
  dayOpen: number | null;
  sparkline: number[];
  group: string;
  marketTime?: number;
};

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    const live = await fetchYahooLiveQuote(index.yahoo, { fresh: true });
    if (!live) return null;

    // Same session path as Live Chart 1D (Zoom Off) — today's IST closes vs open.
    let sparkline: number[] = [];
    const ohlc = await fetchYahooOhlc(index.yahoo, getTimeframe("1D"));
    const sessionCloses = ohlc?.bars.length
      ? sessionClosesForSparkline(ohlc.bars)
      : [];
    if (sessionCloses.length >= 2) {
      sparkline = sparklineSeries(sessionCloses, live.dayOpen);
    } else {
      sparkline = sparklineSeries([live.dayOpen, live.price], live.dayOpen);
    }

    return {
      id: index.id,
      name: index.name,
      price: live.price,
      change: live.change,
      changePercent: live.changePercent,
      dayOpen: live.dayOpen,
      sparkline,
      group: index.group,
      marketTime: live.marketTime,
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
              dayOpen: null,
              sparkline: [],
              group: index.group,
            }))
          ),
    marketStatus: getNseMarketStatus(),
    asOf: new Date().toISOString(),
  });
}
