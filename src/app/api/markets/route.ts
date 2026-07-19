import { getSession } from "@/lib/auth";
import { getNseMarketStatus } from "@/lib/market-hours";
import { INDIAN_MARKET_INDICES, sortByDisplayOrder } from "@/data/indian-markets";
import {
  fetchYahooLiveQuote,
  fetchYahooOhlc,
  mapPool,
  sessionSparkPath,
} from "@/lib/yahoo-ohlc";
import { sparklineSeries } from "@/lib/sparkline";
import { normalizeLiveQuote } from "@/lib/market-quote";
import { getTimeframe } from "@/lib/chart-timeframes";
import { jsonDynamic } from "@/lib/json-dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type MarketQuote = {
  id: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** Today's session open — same basis as tape / Snapshot / 1D chart. */
  dayOpen: number | null;
  sparkline: number[];
  group: (typeof INDIAN_MARKET_INDICES)[number]["group"];
  marketTime?: number;
};

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    // Parallel: live print + 1D 5m path (same feed as Live Chart Zoom Off).
    const [live, ohlc] = await Promise.all([
      fetchYahooLiveQuote(index.yahoo, { fresh: true }),
      fetchYahooOhlc(index.yahoo, getTimeframe("1D")),
    ]);
    if (!live) return null;

    const sparkPath = ohlc?.bars.length
      ? sessionSparkPath(ohlc.bars)
      : null;

    // Prefer the 5m session open so sparklines and % share one baseline.
    const dayOpen = sparkPath?.sessionOpen ?? live.dayOpen;
    const priced = normalizeLiveQuote({
      price: live.price,
      dayOpen,
      marketTime: live.marketTime,
    });

    let sparkline: number[] = [];
    if (sparkPath && sparkPath.prices.length >= 2) {
      // Keep last point nailed to the live print so tape/chart stay locked.
      const prices = sparkPath.prices.slice();
      prices[prices.length - 1] = live.price;
      sparkline = sparklineSeries(prices, dayOpen);
    } else {
      sparkline = sparklineSeries([dayOpen, live.price], dayOpen);
    }

    return {
      id: index.id,
      name: index.name,
      price: priced.price,
      change: priced.change,
      changePercent: priced.changePercent,
      dayOpen: priced.dayOpen,
      sparkline,
      group: index.group,
      marketTime: priced.marketTime,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonDynamic({ error: "Unauthorized" }, { status: 401 });
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

  return jsonDynamic({
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
