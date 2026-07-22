import { z } from "zod";
import { getSession } from "@/lib/auth";
import { computeTimeframeReturn } from "@/lib/chart-period-return";
import { getTimeframe } from "@/lib/chart-timeframes";
import { jsonDynamic } from "@/lib/json-dynamic";
import { hasTodaySessionPrint } from "@/lib/market-hours";
import {
  fetchYahooOhlc,
  fetchYahooOhlcBefore,
  fetchYahooLiveQuote,
  sessionSparkPath,
} from "@/lib/yahoo-ohlc";
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
  const ohlc = isHistory
    ? await withTimeout(
        fetchYahooOhlcBefore(index.yahoo, timeframe, parsed.data.before!),
        12_000,
        null
      )
    : await withTimeout(
        fetchYahooOhlc(index.yahoo, timeframe, { inception }),
        12_000,
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

  const lastBar = ohlc.bars[ohlc.bars.length - 1];
  const earliest = ohlc.bars[0].time;
  const nowSec = Math.floor(Date.now() / 1000);
  const MIN_HISTORY_UNIX = 946_684_800; // 2000-01-01 UTC
  const hasMore = isHistory
    ? ohlc.bars.length > 0 && earliest > MIN_HISTORY_UNIX
    : nowSec - earliest > 86_400;

  if (isHistory) {
    return jsonDynamic({
      indexId: index.id,
      name: index.name,
      timeframe: timeframe.id,
      bars: ohlc.bars,
      hasMore,
      earliestTime: earliest,
      asOf: new Date().toISOString(),
    });
  }

  // Prefer NSE / BSE LTP + prev-close % (Zerodha) over Yahoo when available.
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
  // Prefer exchange session open for Open line when NSE/BSE LTP is used.
  const sessionOpen =
    timeframe.id === "1D"
      ? venue?.dayOpen ??
        sessionSparkPath(ohlc.bars)?.sessionOpen ??
        live?.dayOpen ??
        null
      : venue?.dayOpen ?? live?.dayOpen ?? null;
  const period = computeTimeframeReturn(
    ohlc.bars,
    timeframe.id,
    price,
    sessionOpen
  );
  // 1D headline matches Zerodha / exchange: change vs previous close (not session open).
  const previousClose = venue?.previousClose ?? live?.previousClose ?? null;
  const usePrevClose =
    timeframe.id === "1D" &&
    previousClose != null &&
    Number.isFinite(previousClose) &&
    previousClose > 0;
  const change = usePrevClose
    ? venue?.change ?? price - previousClose
    : (period?.change ?? live?.change ?? 0);
  const changePercent = usePrevClose
    ? venue?.changePercent ?? ((price - previousClose) / previousClose) * 100
    : (period?.changePercent ?? live?.changePercent ?? 0);
  // Open line stays on session open; headline % uses previousClose when usePrevClose.
  const reference = period?.reference ?? sessionOpen ?? null;
  const basis = usePrevClose
    ? ("prev_close" as const)
    : (period?.basis ?? "day_open");
  const marketTime = venue?.marketTime ?? live?.marketTime ?? lastBar.time;

  return jsonDynamic({
    indexId: index.id,
    name: index.name,
    timeframe: timeframe.id,
    bars: ohlc.bars,
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
      /** False when the feed still shows a prior IST day (e.g. Sensex lag). */
      sessionPrinted: hasTodaySessionPrint(marketTime),
    },
    asOf: new Date().toISOString(),
  });
}
