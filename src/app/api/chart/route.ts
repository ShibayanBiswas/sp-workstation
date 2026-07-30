import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  computeTimeframeReturn,
  timeframeViewBars,
} from "@/lib/chart-period-return";
import { getTimeframe } from "@/lib/chart-timeframes";
import { jsonDynamic } from "@/lib/json-dynamic";
import {
  cashQuoteMarketTime,
  getCashMarketStatus,
  hasTodaySessionPrint,
  lastCashSessionCloseUnix,
} from "@/lib/market-hours";
import {
  fetchYahooOhlc,
  fetchYahooOhlcBefore,
  fetchYahooLiveQuote,
  sessionSparkPath,
  applyLiveCloseToBars,
  snapFormingBarTip,
  yahooIntervalSeconds,
} from "@/lib/yahoo-ohlc";
import {
  changeVersusSessionOpen,
  ohlcSessionOpen,
  resolveSessionOpen,
  sessionBarsAreToday,
} from "@/lib/session-open";
import { INDIAN_MARKET_INDICES, cashExchangeLabel, getIndexById } from "@/data/indian-markets";
import {
  fetchNseIndexQuotes,
  nseIndexNameForId,
} from "@/lib/nse-indices";
import { fetchBseSensexQuote } from "@/lib/bse-sensex";
import { withTimeout } from "@/lib/fetch-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Cap Vercel function runtime so Yahoo history cannot hang the deploy. */
export const maxDuration = 20;

const querySchema = z.object({
  indexId: z.string().min(1),
  timeframe: z.string().optional().default("1D"),
  before: z.coerce.number().int().positive().optional(),
  /** Zoom On — request max available history for the timeframe. */
  full: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return jsonDynamic({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const beforeRaw = searchParams.get("before");
  const fullRaw = searchParams.get("full");
  const parsed = querySchema.safeParse({
    indexId: searchParams.get("indexId"),
    timeframe: searchParams.get("timeframe") ?? "1D",
    before: beforeRaw ? Number(beforeRaw) : undefined,
    full: fullRaw ?? undefined,
  });

  if (!parsed.success) {
    return jsonDynamic({ error: "Invalid request" }, { status: 400 });
  }

  const index = getIndexById(parsed.data.indexId);
  if (!INDIAN_MARKET_INDICES.some((i) => i.id === parsed.data.indexId)) {
    return jsonDynamic({ error: "Unknown index" }, { status: 400 });
  }
  const timeframe = getTimeframe(parsed.data.timeframe);
  const inception =
    parsed.data.full === "1" || parsed.data.full === "true";
  const isHistory = parsed.data.before != null;
  // Budget must cover Yahoo host attempts without eating the whole Vercel slot.
  const ohlcBudgetMs = inception || isHistory ? 12_000 : 6_000;

  // Kick venue LTP in parallel with OHLC — first paint must not wait serially.
  const wantNse =
    !isHistory &&
    timeframe.id === "1D" &&
    index.id !== "sensex" &&
    !!nseIndexNameForId(index.id);
  const wantBse = !isHistory && timeframe.id === "1D" && index.id === "sensex";

  const ohlcPromise = isHistory
    ? withTimeout(
        fetchYahooOhlcBefore(index.yahoo, timeframe, parsed.data.before!),
        ohlcBudgetMs,
        null
      )
    : withTimeout(
        fetchYahooOhlc(index.yahoo, timeframe, { inception }),
        ohlcBudgetMs,
        null
      );
  const nsePromise = wantNse
    ? withTimeout(fetchNseIndexQuotes(), 4_000, new Map())
    : Promise.resolve(new Map());
  const bsePromise = wantBse
    ? withTimeout(fetchBseSensexQuote(), 3_500, null)
    : Promise.resolve(null);

  const [ohlc, nseMap, bse] = await Promise.all([
    ohlcPromise,
    nsePromise,
    bsePromise,
  ]);
  const nse = wantNse ? nseMap.get(index.id) : undefined;

  if (!ohlc || ohlc.bars.length === 0) {
    return jsonDynamic(
      {
        error: isHistory ? "No older history" : "Chart data unavailable",
        bars: [],
        hasMore: false,
      },
      { status: isHistory ? 200 : 503 }
    );
  }

  // Snap only when the returned series is actually intraday.
  const barInterval = ohlc.interval ?? timeframe.interval;
  const intervalSec = yahooIntervalSeconds(barInterval);
  const fullBars =
    intervalSec != null && intervalSec < 86_400
      ? snapFormingBarTip(ohlc.bars, intervalSec)
      : ohlc.bars.slice();

  // Zoom Off default: active period from its open.
  let bars =
    !inception && !isHistory
      ? timeframeViewBars(fullBars, timeframe.id)
      : fullBars;

  if (bars.length === 0) {
    return jsonDynamic(
      {
        error: isHistory ? "No older history" : "Chart data unavailable",
        bars: [],
        hasMore: false,
      },
      { status: isHistory ? 200 : 503 }
    );
  }

  const lastBar = bars[bars.length - 1]!;
  const earliest = bars[0]!.time;
  const MIN_HISTORY_UNIX = 946_684_800; // 2000-01-01 UTC
  const hasMore = isHistory
    ? bars.length > 0 && earliest > MIN_HISTORY_UNIX
    : inception
      ? // Zoom On snapshot may still have older Yahoo history to page in.
        earliest > MIN_HISTORY_UNIX
      : // Period window (Zoom Off) still has older history available for Zoom On.
        true;

  if (isHistory) {
    return jsonDynamic({
      indexId: index.id,
      name: index.name,
      timeframe: timeframe.id,
      bars,
      hasMore,
      earliestTime: earliest,
      asOf: new Date().toISOString(),
    });
  }

  // Prefer per-venue LTP (NSE / BSE) over lagged Yahoo closes.
  // Sensex skips NSE (already parallelized above); other indices skip BSE.
  const venue = bse ?? nse;
  const live = venue
    ? null
    : await withTimeout(fetchYahooLiveQuote(index.yahoo), 3_500, null);
  const price = venue?.price ?? live?.price ?? lastBar.close;

  const ohlcOpen =
    timeframe.id === "1D"
      ? ohlcSessionOpen(fullBars) ??
        sessionSparkPath(fullBars, 96)?.sessionOpen ??
        null
      : null;
  const sessionIsToday =
    timeframe.id === "1D" ? sessionBarsAreToday(fullBars) : true;

  const marketStatus = getCashMarketStatus();
  // NSE has no print stamp — only trust Yahoo session bars for "today".
  // open/LTP vs prevClose alone falsely marks stale prior-session quotes as live.
  const nseConfirmedToday =
    nse != null && !bse && marketStatus === "open" && sessionIsToday;

  // Venue "today" from exchange stamp (BSE dttm) or NSE+Yahoo confirmation.
  const venueIsToday = bse
    ? hasTodaySessionPrint(bse.marketTime)
    : nse
      ? nseConfirmedToday
      : hasTodaySessionPrint(live?.marketTime);

  const venueOpen = venue?.dayOpen ?? live?.dayOpen ?? null;
  // Pre-open / closed / holiday: freeze like the tape — prefer exchange open
  // over Yahoo's first print (Sensex BSE I_open vs ^BSESN mismatch).
  const showPriorSession =
    marketStatus !== "open" || (!sessionIsToday && !venueIsToday);

  // Never rewrite prior-session candles with a live LTP while awaiting today's print.
  const allowLiveTip =
    timeframe.id !== "1D" || sessionIsToday || marketStatus !== "open";
  if (allowLiveTip) {
    bars = applyLiveCloseToBars(bars, price);
  }
  const returnBars = allowLiveTip
    ? applyLiveCloseToBars(fullBars, price)
    : fullBars;

  const sessionOpen =
    timeframe.id === "1D"
      ? showPriorSession
        ? ((venueOpen != null && venueOpen > 0 ? venueOpen : null) ?? ohlcOpen)
        : resolveSessionOpen({
            venueOpen,
            ohlcSessionOpen: ohlcOpen,
            price,
            sessionIsToday,
            venueIsToday,
          })
      : venueOpen;

  // Headline % is always vs active period open (day / week / month / lookback),
  // never vs the Zoom Off view start.
  const period = computeTimeframeReturn(
    returnBars,
    timeframe.id,
    price,
    sessionOpen
  );
  const previousClose = venue?.previousClose ?? live?.previousClose ?? null;

  let change: number;
  let changePercent: number;
  let reference: number | null;
  let basis: "day_open" | "prev_close" | "week_open" | "month_open" | "lookback_open";

  if (timeframe.id === "1D" && sessionOpen != null && sessionOpen > 0) {
    const vsOpen = changeVersusSessionOpen(price, sessionOpen);
    change = vsOpen.change;
    changePercent = vsOpen.changePercent;
    reference = sessionOpen;
    basis = "day_open";
  } else if (period) {
    change = period.change;
    changePercent = period.changePercent;
    reference = period.reference;
    basis = period.basis;
  } else {
    change = 0;
    changePercent = 0;
    reference = null;
    basis = "day_open";
  }

  const marketTimeRaw = venue?.marketTime ?? live?.marketTime ?? lastBar.time;
  let marketTime = marketTimeRaw;
  let sessionPrinted = hasTodaySessionPrint(marketTimeRaw);

  if (timeframe.id === "1D" && nse && !bse) {
    sessionPrinted = nseConfirmedToday;
    marketTime = sessionPrinted
      ? cashQuoteMarketTime(getCashMarketStatus())
      : lastCashSessionCloseUnix();
  } else if (timeframe.id === "1D" && bse) {
    sessionPrinted = hasTodaySessionPrint(bse.marketTime);
    marketTime = sessionPrinted
      ? (bse.marketTime ?? cashQuoteMarketTime(getCashMarketStatus()))
      : (bse.marketTime ?? lastCashSessionCloseUnix());
  }

  return jsonDynamic({
    indexId: index.id,
    name: index.name,
    timeframe: timeframe.id,
    bars,
    hasMore,
    earliestTime: earliest,
    currency: ohlc.currency,
    exchange: cashExchangeLabel(index.id) ?? ohlc.exchange,
    last: {
      price,
      change,
      changePercent,
      reference,
      basis,
      dayOpen: sessionOpen,
      previousClose,
      time: marketTime,
      sessionPrinted,
    },
    asOf: new Date().toISOString(),
  });
}
