import type { ChartTimeframe } from "@/lib/chart-timeframes";
import { filterNseSessionBars } from "@/lib/chart-ist";

export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type OhlcResult = {
  bars: OhlcBar[];
  currency?: string;
  exchange?: string;
};

export type YahooLiveQuote = {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketTime?: number;
};

const YAHOO_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_MS = 25_000;

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  cache.set(key, { at: Date.now(), value });
}

async function fetchYahooJson(path: string): Promise<unknown | null> {
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        cache: "no-store",
        headers: FETCH_HEADERS,
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

function parseBar(
  open: number | null | undefined,
  high: number | null | undefined,
  low: number | null | undefined,
  close: number | null | undefined
): Pick<OhlcBar, "open" | "high" | "low" | "close"> | null {
  if (
    open == null ||
    high == null ||
    low == null ||
    close == null ||
    Number.isNaN(open) ||
    Number.isNaN(high) ||
    Number.isNaN(low) ||
    Number.isNaN(close)
  ) {
    return null;
  }
  return { open, high, low, close };
}

function dedupeAndSortBars(bars: OhlcBar[]): OhlcBar[] {
  const byTime = new Map<number, OhlcBar>();
  for (const bar of bars) {
    byTime.set(bar.time, bar);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function parseYahooPayload(
  data: unknown,
  intraday: boolean,
  yahooSymbol?: string
): OhlcResult | null {
  const result = (data as { chart?: { result?: unknown[] } })?.chart
    ?.result?.[0] as
    | {
        timestamp?: number[];
        indicators?: { quote?: Array<Record<string, (number | null)[]>> };
        meta?: { currency?: string; exchangeName?: string };
      }
    | undefined;

  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return null;

  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const closes: (number | null)[] = quote.close ?? [];
  const volumes: (number | null)[] = quote.volume ?? [];

  const bars: OhlcBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const parsed = parseBar(opens[i], highs[i], lows[i], closes[i]);
    if (!parsed) continue;
    const vol = volumes[i];
    bars.push({
      time: timestamps[i],
      ...parsed,
      ...(vol != null && !Number.isNaN(vol) ? { volume: vol } : {}),
    });
  }

  const sanitized = filterNseSessionBars(
    dedupeAndSortBars(bars),
    intraday,
    yahooSymbol
  );
  if (sanitized.length === 0) return null;

  return {
    bars: sanitized,
    currency: result.meta?.currency,
    exchange: result.meta?.exchangeName,
  };
}

/** Fast live quote from Yahoo meta — more reliable than parsing full OHLC. */
export async function fetchYahooLiveQuote(
  yahooSymbol: string
): Promise<YahooLiveQuote | null> {
  const cacheKey = `quote:${yahooSymbol}`;
  const cached = getCached<YahooLiveQuote>(cacheKey);
  if (cached) return cached;

  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d&includePrePost=false`;
  const data = await fetchYahooJson(path);
  if (!data) return null;

  const meta = (data as { chart?: { result?: Array<{ meta?: Record<string, number> }> } })
    ?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? meta.previousClose;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  if (price == null || Number.isNaN(price)) return null;

  const change =
    meta.regularMarketChange ?? (previousClose != null ? price - previousClose : 0);
  const changePercent =
    meta.regularMarketChangePercent ??
    (previousClose ? (change / previousClose) * 100 : 0);

  const quote: YahooLiveQuote = {
    price,
    change,
    changePercent,
    previousClose: previousClose ?? price,
    marketTime: meta.regularMarketTime,
  };
  setCached(cacheKey, quote);
  return quote;
}

function ohlcPath(
  yahooSymbol: string,
  interval: string,
  range: string,
  period?: { from: number; to: number }
): string {
  const base = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&includePrePost=false&events=div%2Csplits`;
  if (period) {
    return `${base}&period1=${period.from}&period2=${period.to}`;
  }
  return `${base}&range=${range}`;
}

function timeframeCandidates(timeframe: ChartTimeframe) {
  return [
    { interval: timeframe.interval, range: timeframe.range },
    ...(timeframe.fallbacks ?? []),
  ];
}

async function fetchOhlcCandidate(
  yahooSymbol: string,
  interval: string,
  range: string,
  intraday: boolean
): Promise<OhlcResult | null> {
  const data = await fetchYahooJson(ohlcPath(yahooSymbol, interval, range));
  if (!data) return null;
  return parseYahooPayload(data, intraday, yahooSymbol);
}

export async function fetchYahooOhlc(
  yahooSymbol: string,
  timeframe: ChartTimeframe
): Promise<OhlcResult | null> {
  const cacheKey = `ohlc:${yahooSymbol}:${timeframe.id}`;
  const cached = getCached<OhlcResult>(cacheKey);
  if (cached) return cached;

  for (const candidate of timeframeCandidates(timeframe)) {
    const parsed = await fetchOhlcCandidate(
      yahooSymbol,
      candidate.interval,
      candidate.range,
      timeframe.intraday
    );
    if (parsed?.bars.length) {
      setCached(cacheKey, parsed);
      return parsed;
    }
  }

  return null;
}

/** Fetch older candles before `beforeUnix` for scroll-back history. */
export async function fetchYahooOhlcBefore(
  yahooSymbol: string,
  timeframe: ChartTimeframe,
  beforeUnix: number
): Promise<OhlcResult | null> {
  const period2 = Math.max(beforeUnix - 1, 0);
  const period1 = Math.max(period2 - timeframe.historyChunkSec, 0);
  const cacheKey = `ohlc:${yahooSymbol}:${timeframe.id}:before:${period1}:${period2}`;
  const cached = getCached<OhlcResult>(cacheKey);
  if (cached) return cached;

  const data = await fetchYahooJson(
    ohlcPath(yahooSymbol, timeframe.interval, timeframe.range, {
      from: period1,
      to: period2,
    })
  );
  if (!data) return null;

  let parsed = parseYahooPayload(data, timeframe.intraday, yahooSymbol);

  if (!parsed?.bars.length && timeframe.fallbacks?.length) {
    for (const fb of timeframe.fallbacks) {
      const fbData = await fetchYahooJson(
        ohlcPath(yahooSymbol, fb.interval, fb.range, {
          from: period1,
          to: period2,
        })
      );
      parsed = fbData
        ? parseYahooPayload(fbData, timeframe.intraday, yahooSymbol)
        : null;
      if (parsed?.bars.length) break;
    }
  }
  if (parsed) setCached(cacheKey, parsed);
  return parsed;
}

export function mergeOhlcBars(existing: OhlcBar[], older: OhlcBar[]): OhlcBar[] {
  const byTime = new Map<number, OhlcBar>();
  for (const bar of older) byTime.set(bar.time, bar);
  for (const bar of existing) byTime.set(bar.time, bar);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Compact closes for sparklines — skips nulls, keeps order. */
export function closesFromOhlc(bars: OhlcBar[], maxPoints = 24): number[] {
  const closes = bars.map((b) => b.close).filter((v) => !Number.isNaN(v));
  return closes.slice(-maxPoints);
}

/** Run async tasks with limited concurrency. */
export async function mapPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
  return results;
}
