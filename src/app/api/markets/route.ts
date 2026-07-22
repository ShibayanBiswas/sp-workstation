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

async function yahooQuote(
  index: (typeof INDIAN_MARKET_INDICES)[number]
): Promise<MarketQuote | null> {
  try {
    const [live, ohlc] = await Promise.all([
      fetchYahooLiveQuote(index.yahoo, { fresh: true }),
      fetchYahooOhlc(index.yahoo, getTimeframe("1D")),
    ]);
    if (!live) return null;

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
      sparkline = sparklineSeries([dayOpen, live.price], dayOpen);
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

  // NSE cash indices + BSE Sensex (Zerodha prev-close %). Yahoo for FX / fallback.
  const [nseMap, bseSensex] = await Promise.all([
    fetchNseIndexQuotes({ fresh: true }),
    fetchBseSensexQuote({ fresh: true }),
  ]);

  const results = await mapPool(
    INDIAN_MARKET_INDICES,
    async (index) => {
      if (index.id === "sensex" && bseSensex) {
        let sparkline: number[] = [];
        let dayOpen = bseSensex.dayOpen;
        try {
          const ohlc = await fetchYahooOhlc(index.yahoo, getTimeframe("1D"));
          const sparkPath = ohlc?.bars.length
            ? sessionSparkPath(ohlc.bars)
            : null;
          if (sparkPath && sparkPath.prices.length >= 2) {
            dayOpen = sparkPath.sessionOpen;
            const prices = sparkPath.prices.slice();
            prices[prices.length - 1] = bseSensex.price;
            sparkline = sparklineSeries(prices, sparkPath.sessionOpen);
          } else {
            sparkline = sparklineSeries(
              [bseSensex.dayOpen, bseSensex.price],
              bseSensex.dayOpen
            );
          }
        } catch {
          sparkline = sparklineSeries(
            [bseSensex.dayOpen, bseSensex.price],
            bseSensex.dayOpen
          );
        }

        return {
          id: index.id,
          name: index.name,
          price: bseSensex.price,
          change: bseSensex.change,
          changePercent: bseSensex.changePercent,
          dayOpen,
          previousClose: bseSensex.previousClose,
          sparkline,
          group: index.group,
          marketTime: bseSensex.marketTime,
          sessionPrinted: hasTodaySessionPrint(bseSensex.marketTime),
          source: "bse" as const,
        } satisfies MarketQuote;
      }

      if (nseIndexNameForId(index.id)) {
        const nse = nseMap.get(index.id);
        if (nse) {
          // Sparklines still from Yahoo 5m when possible (shape vs session open).
          let sparkline: number[] = [];
          try {
            const ohlc = await fetchYahooOhlc(index.yahoo, getTimeframe("1D"));
            const sparkPath = ohlc?.bars.length
              ? sessionSparkPath(ohlc.bars)
              : null;
            if (sparkPath && sparkPath.prices.length >= 2) {
              const prices = sparkPath.prices.slice();
              prices[prices.length - 1] = nse.price;
              sparkline = sparklineSeries(prices, sparkPath.sessionOpen);
            } else {
              sparkline = sparklineSeries(
                [nse.dayOpen, nse.price],
                nse.dayOpen
              );
            }
          } catch {
            sparkline = sparklineSeries([nse.dayOpen, nse.price], nse.dayOpen);
          }

          return {
            id: index.id,
            name: index.name,
            price: nse.price,
            change: nse.change,
            changePercent: nse.changePercent,
            dayOpen: nse.dayOpen,
            previousClose: nse.previousClose,
            sparkline,
            group: index.group,
            marketTime: nse.marketTime,
            sessionPrinted: hasTodaySessionPrint(nse.marketTime),
            source: "nse" as const,
          } satisfies MarketQuote;
        }
      }
      return yahooQuote(index);
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
