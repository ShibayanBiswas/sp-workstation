import type { ChartTimeframe } from "@/lib/chart-timeframes";
import { filterNseSessionBars, istDateString } from "@/lib/chart-ist";
import { LIVE_REFRESH_MS } from "@/lib/live-refresh";
import { normalizeLiveQuote } from "@/lib/market-quote";
import { fetchWithTimeout, UPSTREAM_TIMEOUT_MS } from "@/lib/fetch-timeout";

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
  /** Today's session open — sparklines / chart Open line. */
  dayOpen: number;
  /** Previous close — Zerodha / NSE day-change basis. */
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
/** Live LTP cache — slightly under the client poll so each tick can refresh. */
const QUOTE_CACHE_MS = Math.max(LIVE_REFRESH_MS - 5_000, 5_000);
/** OHLC/sparklines — longer TTL; shape changes slowly vs LTP. */
const OHLC_CACHE_MS = 60_000;

function getCached<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > ttlMs) return null;
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  cache.set(key, { at: Date.now(), value });
}

async function fetchYahooJson(path: string): Promise<unknown | null> {
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetchWithTimeout(
        `${host}${path}`,
        {
          cache: "no-store",
          headers: FETCH_HEADERS,
        },
        UPSTREAM_TIMEOUT_MS
      );
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

/** Yahoo interval string → seconds (e.g. 5m → 300). */
export function yahooIntervalSeconds(interval: string): number | null {
  const m = interval.trim().match(/^(\d+)(m|h|d|wk)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  if (unit === "d") return n * 86_400;
  if (unit === "wk") return n * 7 * 86_400;
  return null;
}

/**
 * Snap only Yahoo’s advancing live tip into its interval bucket.
 * Leaves completed history untouched (full-series coalesce was flattening shape).
 */
export function snapFormingBarTip(
  bars: OhlcBar[],
  intervalSec: number
): OhlcBar[] {
  if (bars.length === 0 || !Number.isFinite(intervalSec) || intervalSec <= 0) {
    return bars;
  }
  if (bars.length === 1) {
    const only = bars[0]!;
    const bucket = Math.floor(only.time / intervalSec) * intervalSec;
    return [{ ...only, time: bucket }];
  }

  const body = bars.slice(0, -1);
  const tip = bars[bars.length - 1]!;
  const bucket = Math.floor(tip.time / intervalSec) * intervalSec;
  const snapped = { ...tip, time: bucket };
  const prev = body[body.length - 1]!;
  const prevBucket = Math.floor(prev.time / intervalSec) * intervalSec;

  // Live tip landed in the same bucket as the prior bar — merge OHLC.
  if (bucket === prevBucket || bucket === prev.time) {
    body[body.length - 1] = {
      ...prev,
      high: Math.max(prev.high, snapped.high),
      low: Math.min(prev.low, snapped.low),
      close: snapped.close,
      ...(snapped.volume != null || prev.volume != null
        ? { volume: (prev.volume ?? 0) + (snapped.volume ?? 0) }
        : {}),
    };
    return body;
  }

  body.push(snapped);
  return body;
}

/** @deprecated Prefer snapFormingBarTip — kept for any legacy callers. */
export function coalesceBarsToInterval(
  bars: OhlcBar[],
  intervalSec: number
): OhlcBar[] {
  return snapFormingBarTip(bars, intervalSec);
}

/** Patch the forming candle so chart close tracks exchange LTP. */
export function applyLiveCloseToBars(
  bars: OhlcBar[],
  livePrice: number
): OhlcBar[] {
  if (
    bars.length === 0 ||
    !Number.isFinite(livePrice) ||
    livePrice <= 0
  ) {
    return bars;
  }
  const out = bars.slice();
  const last = out[out.length - 1]!;
  out[out.length - 1] = {
    ...last,
    close: livePrice,
    high: Math.max(last.high, livePrice),
    low: Math.min(last.low, livePrice),
  };
  return out;
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

/** Fast live quote — 1m LTP when available, day change vs previous close. */
export async function fetchYahooLiveQuote(
  yahooSymbol: string,
  opts?: { fresh?: boolean }
): Promise<YahooLiveQuote | null> {
  const cacheKey = `quote:${yahooSymbol}`;
  if (!opts?.fresh) {
    const cached = getCached<YahooLiveQuote>(cacheKey, QUOTE_CACHE_MS);
    if (cached) return cached;
  }

  // Parallel: 1m for fresher LTP, daily meta for official open / previous close.
  const [intra, daily] = await Promise.all([
    fetchYahooJson(
      `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`
    ),
    fetchYahooJson(
      `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d&includePrePost=false`
    ),
  ]);

  type ChartResult = {
    meta?: Record<string, number>;
    timestamp?: number[];
    indicators?: {
      quote?: Array<{
        open?: Array<number | null>;
        close?: Array<number | null>;
      }>;
    };
  };

  const intraResult = (intra as { chart?: { result?: ChartResult[] } } | null)
    ?.chart?.result?.[0];
  const dailyResult = (daily as { chart?: { result?: ChartResult[] } } | null)
    ?.chart?.result?.[0];
  const meta = dailyResult?.meta ?? intraResult?.meta;
  if (!meta) return null;

  const quoteBars = dailyResult?.indicators?.quote?.[0];
  const timestamps = dailyResult?.timestamp ?? [];
  const opens = quoteBars?.open ?? [];
  const closes = quoteBars?.close ?? [];

  let barDayOpen: number | null = null;
  let barLastClose: number | null = null;
  for (let i = timestamps.length - 1; i >= 0; i--) {
    const open = opens[i];
    const close = closes[i];
    if (
      barDayOpen == null &&
      typeof open === "number" &&
      Number.isFinite(open) &&
      open > 0
    ) {
      barDayOpen = open;
    }
    if (
      barLastClose == null &&
      typeof close === "number" &&
      Number.isFinite(close)
    ) {
      barLastClose = close;
    }
    if (barDayOpen != null && barLastClose != null) break;
  }

  // Prefer last 1m close when present (reduces Yahoo daily-meta lag).
  const intraCloses = intraResult?.indicators?.quote?.[0]?.close ?? [];
  let intraLast: number | null = null;
  for (let i = intraCloses.length - 1; i >= 0; i--) {
    const c = intraCloses[i];
    if (typeof c === "number" && Number.isFinite(c)) {
      intraLast = c;
      break;
    }
  }
  const intraTimes = intraResult?.timestamp ?? [];
  const intraTime =
    intraTimes.length > 0 ? intraTimes[intraTimes.length - 1] : undefined;

  const price =
    intraLast ??
    meta.regularMarketPrice ??
    barLastClose;
  if (price == null || Number.isNaN(price)) return null;

  const dayOpen =
    (typeof meta.regularMarketOpen === "number" && meta.regularMarketOpen > 0
      ? meta.regularMarketOpen
      : null) ??
    barDayOpen ??
    price;

  const previousClose =
    (typeof meta.chartPreviousClose === "number" &&
    meta.chartPreviousClose > 0
      ? meta.chartPreviousClose
      : null) ??
    (typeof meta.previousClose === "number" && meta.previousClose > 0
      ? meta.previousClose
      : null) ??
    dayOpen;

  const normalized = normalizeLiveQuote({
    price,
    dayOpen,
    previousClose,
    marketTime:
      (typeof intraTime === "number" ? intraTime : undefined) ??
      meta.regularMarketTime,
  });

  const quote: YahooLiveQuote = {
    ...normalized,
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

function timeframeCandidates(
  timeframe: ChartTimeframe,
  opts?: { inception?: boolean }
) {
  if (opts?.inception) {
    return [
      { interval: timeframe.interval, range: timeframe.inceptionRange },
      ...(timeframe.inceptionFallbacks ?? []),
      ...(timeframe.fallbacks ?? []),
      { interval: timeframe.interval, range: timeframe.range },
    ];
  }
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
  const parsed = parseYahooPayload(data, intraday, yahooSymbol);
  if (!parsed?.bars.length) return null;

  // Only snap intraday tips (5m/15m/30m/1h). Daily/weekly already stable.
  const intervalSec = yahooIntervalSeconds(interval);
  if (intraday && intervalSec != null && intervalSec < 86_400) {
    return {
      ...parsed,
      bars: snapFormingBarTip(parsed.bars, intervalSec),
    };
  }
  return parsed;
}

export async function fetchYahooOhlc(
  yahooSymbol: string,
  timeframe: ChartTimeframe,
  opts?: { inception?: boolean }
): Promise<OhlcResult | null> {
  const scope = opts?.inception ? "full" : "default";
  const cacheKey = `ohlc:${yahooSymbol}:${timeframe.id}:${scope}`;
  const cached = getCached<OhlcResult>(cacheKey, OHLC_CACHE_MS);
  if (cached) return cached;

  for (const candidate of timeframeCandidates(timeframe, opts)) {
    const parsed = await fetchOhlcCandidate(
      yahooSymbol,
      candidate.interval,
      candidate.range,
      // Daily/weekly inception fallbacks are not intraday even if the TF is.
      timeframe.intraday && !candidate.interval.endsWith("d") && candidate.interval !== "1wk"
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
  const cached = getCached<OhlcResult>(cacheKey, OHLC_CACHE_MS);
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

  if (parsed?.bars.length) {
    const intervalSec = yahooIntervalSeconds(timeframe.interval);
    if (
      timeframe.intraday &&
      intervalSec != null &&
      intervalSec < 86_400
    ) {
      parsed = {
        ...parsed,
        bars: snapFormingBarTip(parsed.bars, intervalSec),
      };
    }
    setCached(cacheKey, parsed);
  }
  return parsed;
}

/** Compact closes for sparklines — skips nulls, keeps order. */
export function closesFromOhlc(bars: OhlcBar[], maxPoints = 24): number[] {
  const closes = bars.map((b) => b.close).filter((v) => !Number.isNaN(v));
  return closes.slice(-maxPoints);
}

/**
 * Today's IST price path for cash sparklines, or — for FX — the latest IST
 * calendar day available in the bars (USD/INR prints overnight).
 */
export function sessionSparkPath(
  bars: OhlcBar[],
  maxPoints = 96
): { prices: number[]; sessionOpen: number } | null {
  if (bars.length === 0) return null;
  const lastDay = istDateString(bars[bars.length - 1].time);
  let dayBars = bars.filter((b) => istDateString(b.time) === lastDay);
  // FX can be sparse just after IST midnight — fall back to last ~24h of bars.
  if (dayBars.length < 4 && bars.length >= 4) {
    const cutoff = bars[bars.length - 1]!.time - 24 * 3600;
    dayBars = bars.filter((b) => b.time >= cutoff);
  }
  if (dayBars.length === 0) return null;

  const sessionOpen = dayBars[0]!.open;
  if (!Number.isFinite(sessionOpen) || sessionOpen === 0) return null;

  const prices: number[] = [sessionOpen];
  for (const bar of dayBars) {
    if (Number.isFinite(bar.close)) prices.push(bar.close);
  }
  if (prices.length < 2) return null;

  if (prices.length <= maxPoints) {
    return { prices, sessionOpen };
  }

  const step = Math.ceil((prices.length - 1) / (maxPoints - 1));
  const sampled: number[] = [prices[0]!];
  for (let i = step; i < prices.length - 1; i += step) {
    sampled.push(prices[i]!);
  }
  sampled.push(prices[prices.length - 1]!);
  return { prices: sampled, sessionOpen };
}

/** @deprecated Prefer sessionSparkPath — kept for any legacy callers. */
export function sessionClosesForSparkline(
  bars: OhlcBar[],
  maxPoints = 78
): number[] {
  return sessionSparkPath(bars, maxPoints)?.prices.slice(1) ?? [];
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
