import { getSession } from "@/lib/auth";
import {
  getCashMarketStatus,
  hasTodaySessionPrint,
  lastCashSessionCloseUnix,
  cashQuoteMarketTime,
  type MarketStatus,
} from "@/lib/market-hours";
import { INDIAN_MARKET_INDICES, sortByDisplayOrder } from "@/data/indian-markets";
import {
  fetchYahooLiveQuote,
  fetchYahooOhlc,
  mapPool,
} from "@/lib/yahoo-ohlc";
import { sparklineSeries } from "@/lib/sparkline";
import { normalizeLiveQuote } from "@/lib/market-quote";
import {
  changeVersusSessionOpen,
  resolveSessionOpen,
} from "@/lib/session-open";
import {
  selectTapeSessionBars,
  sessionSparkPrices,
} from "@/lib/session-spark";
import { getTimeframe } from "@/lib/chart-timeframes";
import { jsonDynamic } from "@/lib/json-dynamic";
import {
  fetchNseIndexQuotes,
  nseIndexNameForId,
} from "@/lib/nse-indices";
import { fetchBseSensexQuote } from "@/lib/bse-sensex";
import { ROUTE_BUDGET_MS, withTimeout } from "@/lib/fetch-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Cap Vercel function runtime so cold Yahoo/NSE paths cannot hang the deploy. */
export const maxDuration = 20;

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

type MarketsPayload = {
  quotes: MarketQuote[];
  marketStatus: MarketStatus;
  asOf: string;
};

const MARKETS_CACHE_MS = 10_000;
let marketsCache: { at: number; payload: MarketsPayload } | null = null;
let marketsInflight: Promise<MarketsPayload> | null = null;

function quickSpark(dayOpen: number, price: number): number[] {
  return sparklineSeries([dayOpen, price], dayOpen);
}

function emptyQuotes(): MarketQuote[] {
  return sortByDisplayOrder(
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
  );
}

type SparkResult = {
  /** Raw session path prices (open first, then closes), tip = display price. */
  prices: number[];
  ohlcOpen: number | null;
  sessionIsToday: boolean;
  /** Last close of the selected session (prior-day freeze during pre-open). */
  sessionLastClose: number | null;
};

/**
 * Tape/Snapshot only — Yahoo path for one cash session.
 * Grows through the live day; holiday / pre-open → last completed session.
 */
async function sessionSparkline(
  yahooSymbol: string,
  livePrice: number,
  status: MarketStatus
): Promise<SparkResult> {
  const ohlc = await withTimeout(
    fetchYahooOhlc(yahooSymbol, getTimeframe("1D")),
    3_500,
    null
  );
  if (!ohlc?.bars.length) {
    return {
      prices: [],
      ohlcOpen: null,
      sessionIsToday: false,
      sessionLastClose: null,
    };
  }

  const selected = selectTapeSessionBars(ohlc.bars, { status });
  const tip =
    selected.sessionIsToday || status === "open"
      ? livePrice
      : (selected.sessionLastClose ?? livePrice);

  if (selected.bars.length === 0) {
    return {
      prices: [],
      ohlcOpen: null,
      sessionIsToday: false,
      sessionLastClose: selected.sessionLastClose,
    };
  }

  const prices = sessionSparkPrices(selected.bars, tip, 96);
  return {
    prices,
    ohlcOpen: selected.sessionOpen,
    sessionIsToday: selected.sessionIsToday,
    sessionLastClose: selected.sessionLastClose,
  };
}

/**
 * One open basis per index for tape/snapshot:
 * - Live session → venue/OHLC open of today; spark grows from that open
 * - Pre-open / holiday / weekend → last completed session open + close
 */
function finalizeQuote(args: {
  index: (typeof INDIAN_MARKET_INDICES)[number];
  price: number;
  venueOpen: number | null;
  previousClose: number;
  marketTime?: number;
  spark: SparkResult;
  source: "nse" | "bse" | "yahoo";
  status: MarketStatus;
}): MarketQuote {
  const {
    index,
    price: livePrice,
    venueOpen,
    previousClose,
    marketTime,
    spark,
    source,
    status,
  } = args;

  // NSE has no stamp — treat as venue-today once Yahoo or open/LTP confirm.
  const openMoved =
    venueOpen != null &&
    previousClose > 0 &&
    Math.abs(venueOpen - previousClose) >= 0.05;
  const ltpMoved =
    previousClose > 0 && Math.abs(livePrice - previousClose) >= 0.05;
  const nseConfirmedToday =
    source === "nse" &&
    status === "open" &&
    (spark.sessionIsToday || openMoved || ltpMoved);

  const venueIsToday =
    hasTodaySessionPrint(marketTime) || nseConfirmedToday;
  const showPriorSession =
    status !== "open" || (!spark.sessionIsToday && !venueIsToday);

  // Pre-open / closed / holiday: freeze to last session close so % is that day's move.
  const price = showPriorSession
    ? (spark.sessionLastClose ?? livePrice)
    : livePrice;

  const sessionOpen = showPriorSession
    ? (spark.ohlcOpen ??
      (venueOpen != null && venueOpen > 0 ? venueOpen : null))
    : resolveSessionOpen({
        venueOpen,
        ohlcSessionOpen: spark.ohlcOpen,
        price,
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
    const prices = spark.prices.slice();
    prices[0] = open;
    if (!showPriorSession) {
      prices[prices.length - 1] = price;
    }
    sparkline = sparklineSeries(prices, open);
  } else {
    sparkline = quickSpark(open, price);
  }

  // NSE has no print stamp — confirm today's session via Yahoo bars or a
  // venue open that has diverged from previous close (live open printed).
  // Sensex (BSE) keeps its real dttm via hasTodaySessionPrint.
  let resolvedMarketTime = marketTime;
  let sessionPrinted = hasTodaySessionPrint(marketTime);
  if (source === "nse" && status === "open") {
    sessionPrinted = nseConfirmedToday;
    resolvedMarketTime = nseConfirmedToday
      ? cashQuoteMarketTime(status)
      : lastCashSessionCloseUnix();
  } else if (source === "bse" && status === "open" && !sessionPrinted) {
    // BSE stamp still on prior day — awaiting today's Sensex print.
    resolvedMarketTime = marketTime ?? lastCashSessionCloseUnix();
  } else if (source === "nse" && status !== "open") {
    resolvedMarketTime = marketTime ?? lastCashSessionCloseUnix();
    sessionPrinted = false;
  }

  const priced = normalizeLiveQuote({
    price,
    dayOpen: open,
    previousClose,
    marketTime: resolvedMarketTime,
  });

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
  index: (typeof INDIAN_MARKET_INDICES)[number],
  status: MarketStatus
): Promise<MarketQuote | null> {
  try {
    const live = await withTimeout(
      fetchYahooLiveQuote(index.yahoo),
      4_000,
      null
    );
    if (!live) return null;

    const spark = await sessionSparkline(index.yahoo, live.price, status);

    return finalizeQuote({
      index,
      price: live.price,
      venueOpen: live.dayOpen,
      previousClose: live.previousClose,
      marketTime: live.marketTime,
      spark,
      source: "yahoo",
      status,
    });
  } catch {
    return null;
  }
}

async function buildMarketsPayload(): Promise<MarketsPayload> {
  const status = getCashMarketStatus();

  const [nseMap, bseSensex] = await Promise.all([
    withTimeout(fetchNseIndexQuotes(), 6_000, new Map()),
    withTimeout(fetchBseSensexQuote(), 4_000, null),
  ]);

  const results = await mapPool(
    INDIAN_MARKET_INDICES,
    async (index) => {
      // Sensex — BSE open / LTP only.
      if (index.id === "sensex" && bseSensex) {
        const spark = await sessionSparkline(
          index.yahoo,
          bseSensex.price,
          status
        );
        return finalizeQuote({
          index,
          price: bseSensex.price,
          venueOpen: bseSensex.dayOpen,
          previousClose: bseSensex.previousClose,
          marketTime: bseSensex.marketTime,
          spark,
          source: "bse",
          status,
        });
      }

      // NSE cash indices — each symbol's own NSE open / LTP.
      if (nseIndexNameForId(index.id)) {
        const nse = nseMap.get(index.id);
        if (nse) {
          const spark = await sessionSparkline(index.yahoo, nse.price, status);
          return finalizeQuote({
            index,
            price: nse.price,
            venueOpen: nse.dayOpen,
            previousClose: nse.previousClose,
            marketTime: nse.marketTime,
            spark,
            source: "nse",
            status,
          });
        }
      }

      // Venue miss — Yahoo fallback, still vs session open.
      return withTimeout(yahooQuote(index, status), 6_000, null);
    },
    6
  );

  const seen = new Set<string>();
  const quotes = sortByDisplayOrder(
    (results.filter(Boolean) as MarketQuote[]).filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
  );

  return {
    quotes: quotes.length > 0 ? quotes : emptyQuotes(),
    marketStatus: status,
    asOf: new Date().toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonDynamic({ error: "Unauthorized" }, { status: 401 });
  }

  if (marketsCache && Date.now() - marketsCache.at < MARKETS_CACHE_MS) {
    return jsonDynamic(marketsCache.payload);
  }

  if (!marketsInflight) {
    marketsInflight = buildMarketsPayload()
      .then((payload) => {
        marketsCache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        marketsInflight = null;
      });
  }

  const stale = marketsCache?.payload;
  const payload = await withTimeout(
    marketsInflight,
    ROUTE_BUDGET_MS,
    stale ?? {
      quotes: emptyQuotes(),
      marketStatus: getCashMarketStatus(),
      asOf: new Date().toISOString(),
    }
  );

  return jsonDynamic(payload);
}
