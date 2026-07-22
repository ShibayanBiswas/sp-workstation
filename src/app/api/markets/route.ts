import { getSession } from "@/lib/auth";
import {
  getNseMarketStatus,
  hasTodaySessionPrint,
} from "@/lib/market-hours";
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
import {
  fetchNseIndexQuotes,
  nseIndexNameForId,
} from "@/lib/nse-indices";
import { fetchBseSensexQuote } from "@/lib/bse-sensex";
import { withTimeout } from "@/lib/fetch-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type MarketQuote = {
  id: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** Today's session open — sparklines / chart Open line. */
  dayOpen: number | null;
  /** Previous close — tape / Snapshot % (Zerodha-compatible). */
  previousClose: number | null;
  sparkline: number[];
  group: (typeof INDIAN_MARKET_INDICES)[number]["group"];
  marketTime?: number;
  /** True when marketTime falls on today's IST calendar day. */
  sessionPrinted: boolean;
  /** Quote vendor used for LTP / day change. */
  source?: "nse" | "bse" | "yahoo";
};

/** Fast open→LTP spark — never blocks the tape on Yahoo OHLC. */
function quickSpark(dayOpen: number, price: number): number[] {
  return sparklineSeries([dayOpen, price], dayOpen);
}

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    // Live quote is required; OHLC sparkle is best-effort with a short cap.
    const live = await fetchYahooLiveQuote(index.yahoo, { fresh: true });
    if (!live) return null;

    const ohlc = await withTimeout(
      fetchYahooOhlc(index.yahoo, getTimeframe("1D")),
      2_500,
      null
    );

    const sparkPath = ohlc?.bars.length
      ? sessionSparkPath(ohlc.bars)
      : null;

    const dayOpen = sparkPath?.sessionOpen ?? live.dayOpen;
    const priced = normalizeLiveQuote({
      price: live.price,
      dayOpen,
      previousClose: live.previousClose,
      marketTime: live.marketTime,
    });

    let sparkline: number[] = [];
    if (sparkPath && sparkPath.prices.length >= 2) {
      const prices = sparkPath.prices.slice();
      prices[prices.length - 1] = live.price;
      sparkline = sparklineSeries(prices, dayOpen);
    } else {
      sparkline = quickSpark(dayOpen, live.price);
    }

    return {
      id: index.id,
      name: index.name,
      price: priced.price,
      change: priced.change,
      changePercent: priced.changePercent,
      dayOpen: priced.dayOpen,
      previousClose: priced.previousClose,
      sparkline,
      group: index.group,
      marketTime: priced.marketTime,
      sessionPrinted: hasTodaySessionPrint(priced.marketTime),
      source: "yahoo",
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

  // Exchange LTP first (timed upstream). Skip Yahoo OHLC for NSE/BSE so the
  // tape cannot hang when Yahoo is slow — sparklines use open→last.
  const [nseMap, bseSensex] = await Promise.all([
    fetchNseIndexQuotes({ fresh: true }),
    fetchBseSensexQuote({ fresh: true }),
  ]);

  const results = await mapPool(
    INDIAN_MARKET_INDICES,
    async (index) => {
      if (index.id === "sensex" && bseSensex) {
        return {
          id: index.id,
          name: index.name,
          price: bseSensex.price,
          change: bseSensex.change,
          changePercent: bseSensex.changePercent,
          dayOpen: bseSensex.dayOpen,
          previousClose: bseSensex.previousClose,
          sparkline: quickSpark(bseSensex.dayOpen, bseSensex.price),
          group: index.group,
          marketTime: bseSensex.marketTime,
          sessionPrinted: hasTodaySessionPrint(bseSensex.marketTime),
          source: "bse" as const,
        } satisfies MarketQuote;
      }

      if (nseIndexNameForId(index.id)) {
        const nse = nseMap.get(index.id);
        if (nse) {
          return {
            id: index.id,
            name: index.name,
            price: nse.price,
            change: nse.change,
            changePercent: nse.changePercent,
            dayOpen: nse.dayOpen,
            previousClose: nse.previousClose,
            sparkline: quickSpark(nse.dayOpen, nse.price),
            group: index.group,
            marketTime: nse.marketTime,
            sessionPrinted: hasTodaySessionPrint(nse.marketTime),
            source: "nse" as const,
          } satisfies MarketQuote;
        }
      }

      return withTimeout(yahooQuote(index), 10_000, null);
    },
    3
  );

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
              previousClose: null,
              sparkline: [],
              group: index.group,
              sessionPrinted: false,
            }))
          ),
    marketStatus: getNseMarketStatus(),
    asOf: new Date().toISOString(),
  });
}
