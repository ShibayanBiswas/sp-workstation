import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getTimeframe } from "@/lib/chart-timeframes";
import { fetchYahooOhlc, fetchYahooLiveQuote } from "@/lib/yahoo-ohlc";
import { INDIAN_MARKET_INDICES, getIndexById } from "@/data/indian-markets";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  indexId: z.string().min(1),
  timeframe: z.string().optional().default("1D"),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    indexId: searchParams.get("indexId"),
    timeframe: searchParams.get("timeframe") ?? "1D",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const index = getIndexById(parsed.data.indexId);
  if (!INDIAN_MARKET_INDICES.some((i) => i.id === parsed.data.indexId)) {
    return NextResponse.json({ error: "Unknown index" }, { status: 400 });
  }
  const timeframe = getTimeframe(parsed.data.timeframe);
  const ohlc = await fetchYahooOhlc(index.yahoo, timeframe);

  if (!ohlc) {
    return NextResponse.json(
      { error: "Chart data unavailable", bars: [] },
      { status: 503 }
    );
  }

  const lastBar = ohlc.bars[ohlc.bars.length - 1];
  const prevBar = ohlc.bars.length > 1 ? ohlc.bars[ohlc.bars.length - 2] : null;
  let price = lastBar.close;
  let change = prevBar ? price - prevBar.close : 0;
  let changePercent = prevBar?.close ? (change / prevBar.close) * 100 : 0;

  const live = await fetchYahooLiveQuote(index.yahoo);
  if (live) {
    price = live.price;
    change = live.change;
    changePercent = live.changePercent;
  }

  const last = { close: price, time: lastBar.time };

  return NextResponse.json({
    indexId: index.id,
    name: index.name,
    timeframe: timeframe.id,
    bars: ohlc.bars,
    currency: ohlc.currency,
    exchange: ohlc.exchange,
    last: {
      price: last.close,
      change,
      changePercent,
      time: last.time,
    },
    asOf: new Date().toISOString(),
  });
}
