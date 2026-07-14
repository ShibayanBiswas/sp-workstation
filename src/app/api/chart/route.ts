import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { computeTimeframeReturn } from "@/lib/chart-period-return";
import { getTimeframe } from "@/lib/chart-timeframes";
import {
  fetchYahooOhlc,
  fetchYahooOhlcBefore,
  fetchYahooLiveQuote,
} from "@/lib/yahoo-ohlc";
import { INDIAN_MARKET_INDICES, getIndexById } from "@/data/indian-markets";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  indexId: z.string().min(1),
  timeframe: z.string().optional().default("1D"),
  before: z.coerce.number().int().positive().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const beforeRaw = searchParams.get("before");
  const parsed = querySchema.safeParse({
    indexId: searchParams.get("indexId"),
    timeframe: searchParams.get("timeframe") ?? "1D",
    before: beforeRaw ? Number(beforeRaw) : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const index = getIndexById(parsed.data.indexId);
  if (!INDIAN_MARKET_INDICES.some((i) => i.id === parsed.data.indexId)) {
    return NextResponse.json({ error: "Unknown index" }, { status: 400 });
  }
  const timeframe = getTimeframe(parsed.data.timeframe);
  const isHistory = parsed.data.before != null;
  const ohlc = isHistory
    ? await fetchYahooOhlcBefore(index.yahoo, timeframe, parsed.data.before!)
    : await fetchYahooOhlc(index.yahoo, timeframe);

  if (!ohlc || ohlc.bars.length === 0) {
    return NextResponse.json(
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
    return NextResponse.json({
      indexId: index.id,
      name: index.name,
      timeframe: timeframe.id,
      bars: ohlc.bars,
      hasMore,
      earliestTime: earliest,
      asOf: new Date().toISOString(),
    });
  }

  const live = await fetchYahooLiveQuote(index.yahoo, { fresh: true });
  const price = live?.price ?? lastBar.close;
  const period = computeTimeframeReturn(ohlc.bars, timeframe.id, price);
  const change = period?.change ?? 0;
  const changePercent = period?.changePercent ?? 0;

  return NextResponse.json({
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
      reference: period?.reference ?? null,
      time: live?.marketTime ?? lastBar.time,
    },
    asOf: new Date().toISOString(),
  });
}
