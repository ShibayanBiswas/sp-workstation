import { z } from "zod";
import { getSession } from "@/lib/auth";
import { computeTimeframeReturn } from "@/lib/chart-period-return";
import { getTimeframe } from "@/lib/chart-timeframes";
import { jsonDynamic } from "@/lib/json-dynamic";
import {
  hasTodaySessionPrint,
  isFxInstrumentLive,
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
import { tradingSessionBars } from "@/lib/chart-ist";
import {
  changeVersusSessionOpen,
  ohlcSessionOpen,
  resolveSessionOpen,
  sessionBarsAreToday,
} from "@/lib/session-open";
import { INDIAN_MARKET_INDICES, getIndexById } from "@/data/indian-markets";
import {
  fetchNseIndexQuotes,
  nseIndexNameForId,
} from "@/lib/nse-indices";
import { fetchBseSensexQuote } from "@/lib/bse-sensex";
import { withTimeout } from "@/lib/fetch-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  // Budget must cover sequential Yahoo host attempts (8s each) + fallbacks.
  const ohlcBudgetMs = inception || isHistory ? 22_000 : 18_000;
  const ohlc = isHistory
    ? await withTimeout(
        fetchYahooOhlcBefore(index.yahoo, timeframe, parsed.data.before!),
        ohlcBudgetMs,
        null
      )
    : await withTimeout(
        fetchYahooOhlc(index.yahoo, timeframe, { inception }),
        ohlcBudgetMs,
        null
      );

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

  // Re-assert interval buckets (history path / cache may predate snap).
  const intervalSec = yahooIntervalSeconds(timeframe.interval);
  let bars =
    timeframe.intraday && intervalSec != null && intervalSec < 86_400
      ? snapFormingBarTip(ohlc.bars, intervalSec)
      : ohlc.bars.slice();

  // Default 1D view = one trading session from that day's first print.
  // Zoom/history (`full` / `before`) keep multi-day intraday history.
  if (timeframe.id === "1D" && !inception && !isHistory) {
    bars = tradingSessionBars(bars, { fx: index.group === "fx" });
  }

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
  const nowSec = Math.floor(Date.now() / 1000);
  const MIN_HISTORY_UNIX = 946_684_800; // 2000-01-01 UTC
  const hasMore = isHistory
    ? bars.length > 0 && earliest > MIN_HISTORY_UNIX
    : inception || timeframe.id !== "1D"
      ? nowSec - earliest > 86_400
      : false;

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

  // Prefer per-venue LTP (NSE / BSE / Yahoo FX) over lagged Yahoo closes.
  const nse =
    timeframe.id === "1D" && nseIndexNameForId(index.id)
      ? (await fetchNseIndexQuotes({ fresh: true })).get(index.id)
      : undefined;
  const bse =
    timeframe.id === "1D" && index.id === "sensex"
      ? await fetchBseSensexQuote({ fresh: true })
      : undefined;
  const venue = bse ?? nse;
  const live = venue
    ? null
    : await fetchYahooLiveQuote(index.yahoo, { fresh: true });
  const price = venue?.price ?? live?.price ?? lastBar.close;
  // Candle pane must track exchange LTP — not a lagged Yahoo close.
  bars = applyLiveCloseToBars(bars, price);

  const isFx = index.group === "fx";
  const ohlcOpen =
    timeframe.id === "1D"
      ? ohlcSessionOpen(bars, { fx: isFx }) ??
        sessionSparkPath(bars, 96, { fx: isFx })?.sessionOpen ??
        null
      : null;
  const sessionIsToday =
    timeframe.id === "1D" ? sessionBarsAreToday(bars) : true;
  const venueIsToday =
    sessionIsToday ||
    hasTodaySessionPrint(venue?.marketTime ?? live?.marketTime) ||
    (isFx && isFxInstrumentLive(venue?.marketTime ?? live?.marketTime));

  // Day % / Open line = venue session open while today; else last session OHLC open.
  const sessionOpen =
    timeframe.id === "1D"
      ? resolveSessionOpen({
          venueOpen: venue?.dayOpen ?? live?.dayOpen ?? null,
          ohlcSessionOpen: ohlcOpen,
          sessionIsToday,
          venueIsToday,
        })
      : (venue?.dayOpen ?? live?.dayOpen ?? null);

  const period = computeTimeframeReturn(
    bars,
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
  } else {
    change = period?.change ?? live?.change ?? venue?.change ?? 0;
    changePercent =
      period?.changePercent ?? live?.changePercent ?? venue?.changePercent ?? 0;
    reference = period?.reference ?? sessionOpen ?? null;
    basis = period?.basis ?? "day_open";
  }

  const marketTime = venue?.marketTime ?? live?.marketTime ?? lastBar.time;
  const sessionPrinted = isFx
    ? hasTodaySessionPrint(marketTime) || isFxInstrumentLive(marketTime)
    : hasTodaySessionPrint(marketTime);

  return jsonDynamic({
    indexId: index.id,
    name: index.name,
    timeframe: timeframe.id,
    bars,
    hasMore,
    earliestTime: earliest,
    currency: ohlc.currency,
    exchange: ohlc.exchange,
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
