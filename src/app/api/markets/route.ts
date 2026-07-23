import { getSession } from "@/lib/auth";
import {
  getNseMarketStatus,
  hasTodaySessionPrint,
  fxQuoteMarketTime,
  isFxInstrumentLive,
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
  /** Today's session open — tape / Snapshot % and sparklines. */
  dayOpen: number | null;
  /** Previous close (context only; day % uses open). */
  previousClose: number | null;
  sparkline: number[];
  group: (typeof INDIAN_MARKET_INDICES)[number]["group"];
  marketTime?: number;
  /** True when marketTime falls on today's IST calendar day. */
  sessionPrinted: boolean;
  /** Quote vendor used for LTP / day change. */
  source?: "nse" | "bse" | "yahoo";
};

/** Fallback only when intraday OHLC is unavailable. */
function quickSpark(dayOpen: number, price: number): number[] {
  return sparklineSeries([dayOpen, price], dayOpen);
}

/**
 * Real session spark from Yahoo 5m path (cached ~60s). Anchored to the
 * exchange session open (`fallbackOpen`) so shape + % agree. Timed so a slow
 * Yahoo host never blocks the tape.
 */
async function sessionSparkline(
  yahooSymbol: string,
  price: number,
  fallbackOpen: number
): Promise<{ sparkline: number[]; dayOpen: number }> {
  const ohlc = await withTimeout(
    fetchYahooOhlc(yahooSymbol, getTimeframe("1D")),
    3_500,
    null
  );
  const path = ohlc?.bars.length ? sessionSparkPath(ohlc.bars) : null;
  const dayOpen =
    Number.isFinite(fallbackOpen) && fallbackOpen > 0
      ? fallbackOpen
      : (path?.sessionOpen ?? fallbackOpen);
  if (!path || path.prices.length < 2) {
    return {
      sparkline: quickSpark(dayOpen, price),
      dayOpen,
    };
  }
  const prices = path.prices.slice();
  prices[prices.length - 1] = price;
  return {
    sparkline: sparklineSeries(prices, dayOpen),
    dayOpen,
  };
}

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    const live = await fetchYahooLiveQuote(index.yahoo, { fresh: true });
    if (!live) return null;

    const spark = await sessionSparkline(
      index.yahoo,
      live.price,
      live.dayOpen
    );

    const isFx = index.group === "fx";
    const marketTime = isFx
      ? fxQuoteMarketTime(live.marketTime)
      : live.marketTime;
    const sessionPrinted = isFx
      ? marketTime != null &&
        (hasTodaySessionPrint(marketTime) || isFxInstrumentLive(marketTime))
      : hasTodaySessionPrint(marketTime);

    const priced = normalizeLiveQuote({
      price: live.price,
      dayOpen: spark.dayOpen,
      previousClose: live.previousClose,
      marketTime,
    });

    return {
      id: index.id,
      name: index.name,
      price: priced.price,
      change: priced.change,
      changePercent: priced.changePercent,
      dayOpen: priced.dayOpen,
      previousClose: priced.previousClose,
      sparkline: spark.sparkline,
      group: index.group,
      marketTime: priced.marketTime,
      sessionPrinted,
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

  const [nseMap, bseSensex] = await Promise.all([
    fetchNseIndexQuotes({ fresh: true }),
    fetchBseSensexQuote({ fresh: true }),
  ]);

  const results = await mapPool(
    INDIAN_MARKET_INDICES,
    async (index) => {
      if (index.id === "sensex" && bseSensex) {
        const spark = await sessionSparkline(
          index.yahoo,
          bseSensex.price,
          bseSensex.dayOpen
        );
        return {
          id: index.id,
          name: index.name,
          price: bseSensex.price,
          change: bseSensex.change,
          changePercent: bseSensex.changePercent,
          dayOpen: bseSensex.dayOpen,
          previousClose: bseSensex.previousClose,
          sparkline: spark.sparkline,
          group: index.group,
          marketTime: bseSensex.marketTime,
          sessionPrinted: hasTodaySessionPrint(bseSensex.marketTime),
          source: "bse" as const,
        } satisfies MarketQuote;
      }

      if (nseIndexNameForId(index.id)) {
        const nse = nseMap.get(index.id);
        if (nse) {
          const spark = await sessionSparkline(
            index.yahoo,
            nse.price,
            nse.dayOpen
          );
          return {
            id: index.id,
            name: index.name,
            price: nse.price,
            change: nse.change,
            changePercent: nse.changePercent,
            dayOpen: nse.dayOpen,
            previousClose: nse.previousClose,
            sparkline: spark.sparkline,
            group: index.group,
            marketTime: nse.marketTime,
            sessionPrinted: hasTodaySessionPrint(nse.marketTime),
            source: "nse" as const,
          } satisfies MarketQuote;
        }
      }

      return withTimeout(yahooQuote(index), 10_000, null);
    },
    4
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
