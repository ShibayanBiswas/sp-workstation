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
import {
  changeVersusSessionOpen,
  ohlcSessionOpen,
  resolveSessionOpen,
  sessionBarsAreToday,
} from "@/lib/session-open";
import { tradingSessionBars } from "@/lib/chart-ist";
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
  /** Session open used for day % (today, or last trading day). */
  dayOpen: number | null;
  /** Previous close (context only; day % uses session open). */
  previousClose: number | null;
  sparkline: number[];
  group: (typeof INDIAN_MARKET_INDICES)[number]["group"];
  marketTime?: number;
  /** True when marketTime falls on today's IST calendar day. */
  sessionPrinted: boolean;
  /** Quote vendor used for LTP / day change. */
  source?: "nse" | "bse" | "yahoo";
};

function quickSpark(dayOpen: number, price: number): number[] {
  return sparklineSeries([dayOpen, price], dayOpen);
}

type SparkResult = {
  /** Raw session path prices (open first, then closes), tip = live LTP. */
  prices: number[];
  ohlcOpen: number | null;
  sessionIsToday: boolean;
};

/**
 * Yahoo OHLC path for the active trading session only.
 * Cash → NSE hours day; FX → IST calendar day.
 */
async function sessionSparkline(
  yahooSymbol: string,
  price: number,
  opts?: { fx?: boolean }
): Promise<SparkResult> {
  const isFx = opts?.fx === true;
  const ohlc = await withTimeout(
    fetchYahooOhlc(yahooSymbol, getTimeframe("1D")),
    isFx ? 8_000 : 3_500,
    null
  );
  if (!ohlc?.bars.length) {
    return { prices: [], ohlcOpen: null, sessionIsToday: false };
  }
  const sessionBars = tradingSessionBars(ohlc.bars, { fx: isFx });
  const path = sessionSparkPath(ohlc.bars, 96, { fx: isFx });
  const ohlcOpen =
    path?.sessionOpen ?? ohlcSessionOpen(ohlc.bars, { fx: isFx });
  const sessionIsToday = sessionBarsAreToday(sessionBars);
  if (!path || path.prices.length < 2) {
    return {
      prices: ohlcOpen != null ? [ohlcOpen, price] : [],
      ohlcOpen,
      sessionIsToday,
    };
  }
  const prices = path.prices.slice();
  prices[prices.length - 1] = price;
  return { prices, ohlcOpen, sessionIsToday };
}

/**
 * One open basis per index: venue open while that session is today;
 * last trading day's OHLC open on holiday / weekend / empty morning.
 * Day % and spark always share that open.
 */
function finalizeQuote(args: {
  index: (typeof INDIAN_MARKET_INDICES)[number];
  price: number;
  venueOpen: number | null;
  previousClose: number;
  marketTime?: number;
  spark: SparkResult;
  source: "nse" | "bse" | "yahoo";
}): MarketQuote {
  const { index, price, venueOpen, previousClose, marketTime, spark, source } =
    args;
  const isFx = index.group === "fx";
  const venueIsToday =
    spark.sessionIsToday ||
    hasTodaySessionPrint(marketTime) ||
    (isFx && isFxInstrumentLive(marketTime));

  const sessionOpen = resolveSessionOpen({
    venueOpen,
    ohlcSessionOpen: spark.ohlcOpen,
    sessionIsToday: spark.sessionIsToday,
    venueIsToday,
  });
  const open =
    sessionOpen ??
    (venueOpen != null && venueOpen > 0 ? venueOpen : null) ??
    (previousClose > 0 ? previousClose : price);

  const { change, changePercent } = changeVersusSessionOpen(price, open);

  let sparkline: number[];
  if (spark.prices.length >= 2) {
    // Rebuild % path vs the same open used for the headline number.
    const prices = spark.prices.slice();
    prices[0] = open;
    prices[prices.length - 1] = price;
    sparkline = sparklineSeries(prices, open);
  } else {
    sparkline = quickSpark(open, price);
  }

  const priced = normalizeLiveQuote({
    price,
    dayOpen: open,
    previousClose,
    marketTime,
  });

  const sessionPrinted = isFx
    ? marketTime != null &&
      (hasTodaySessionPrint(marketTime) || isFxInstrumentLive(marketTime))
    : hasTodaySessionPrint(marketTime);

  return {
    id: index.id,
    name: index.name,
    price: priced.price,
    change,
    changePercent,
    dayOpen: open,
    previousClose: priced.previousClose,
    sparkline,
    group: index.group,
    marketTime: priced.marketTime,
    sessionPrinted,
    source,
  };
}

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    const live = await fetchYahooLiveQuote(index.yahoo, { fresh: true });
    if (!live) return null;

    const isFx = index.group === "fx";
    const spark = await sessionSparkline(index.yahoo, live.price, { fx: isFx });
    const marketTime = isFx
      ? fxQuoteMarketTime(live.marketTime)
      : live.marketTime;

    return finalizeQuote({
      index,
      price: live.price,
      venueOpen: live.dayOpen,
      previousClose: live.previousClose,
      marketTime,
      spark,
      source: "yahoo",
    });
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
      // Sensex — BSE open / LTP only.
      if (index.id === "sensex" && bseSensex) {
        const spark = await sessionSparkline(index.yahoo, bseSensex.price);
        return finalizeQuote({
          index,
          price: bseSensex.price,
          venueOpen: bseSensex.dayOpen,
          previousClose: bseSensex.previousClose,
          marketTime: bseSensex.marketTime,
          spark,
          source: "bse",
        });
      }

      // NSE cash indices — each symbol's own NSE open / LTP.
      if (nseIndexNameForId(index.id)) {
        const nse = nseMap.get(index.id);
        if (nse) {
          const spark = await sessionSparkline(index.yahoo, nse.price);
          return finalizeQuote({
            index,
            price: nse.price,
            venueOpen: nse.dayOpen,
            previousClose: nse.previousClose,
            marketTime: nse.marketTime,
            spark,
            source: "nse",
          });
        }
      }

      // USD/INR (FX) + any venue miss — Yahoo, still vs session open.
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
