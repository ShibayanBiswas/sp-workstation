import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
import { istDateString } from "@/lib/chart-ist";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export function barToChartTime(bar: OhlcBar, intraday: boolean): Time {
  return (intraday ? bar.time : istDateString(bar.time)) as Time;
}

/**
 * Lightweight Charts requires strictly ascending unique times.
 * Daily panes use IST calendar dates — collapse same-day unix stamps.
 */
export function dedupeBarsForChart(
  bars: OhlcBar[],
  intraday: boolean
): OhlcBar[] {
  if (bars.length === 0) return bars;

  if (intraday) {
    const byTime = new Map<number, OhlcBar>();
    for (const bar of bars) byTime.set(bar.time, bar);
    return [...byTime.values()].sort((a, b) => a.time - b.time);
  }

  const byDay = new Map<string, OhlcBar>();
  for (const bar of bars) {
    const day = istDateString(bar.time);
    const prev = byDay.get(day);
    if (!prev) {
      byDay.set(day, bar);
      continue;
    }
    const earlier = prev.time <= bar.time ? prev : bar;
    const later = prev.time <= bar.time ? bar : prev;
    const volSum = (prev.volume ?? 0) + (bar.volume ?? 0);
    byDay.set(day, {
      time: later.time,
      open: earlier.open,
      high: Math.max(prev.high, bar.high),
      low: Math.min(prev.low, bar.low),
      close: later.close,
      volume: volSum > 0 ? volSum : later.volume ?? prev.volume,
    });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

/**
 * Yahoo often omits volume on index intraday (Nifty 1D/1W). Build a stable
 * activity proxy from bar range so the volume pane stays populated.
 */
export function resolveBarVolume(bar: OhlcBar): number {
  if (bar.volume != null && Number.isFinite(bar.volume) && bar.volume > 0) {
    return bar.volume;
  }
  const range = Math.max(0, bar.high - bar.low);
  const body = Math.abs(bar.close - bar.open);
  const activity = Math.round((range * 0.7 + body * 0.3) * 80);
  if (activity > 0) return activity;
  // Flat tip / zero-range bars still paint a stub so the pane never looks empty.
  return Math.max(1, Math.round(Math.abs(bar.close) * 0.02));
}

export function buildChartSeries(
  bars: OhlcBar[],
  intraday: boolean,
  volumeUp: string,
  volumeDown: string
) {
  const unique = dedupeBarsForChart(bars, intraday);
  const candles: CandlestickData<Time>[] = [];
  const volumes: HistogramData<Time>[] = [];

  for (const bar of unique) {
    const time = barToChartTime(bar, intraday);
    const up = bar.close >= bar.open;

    candles.push({
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    });

    volumes.push({
      time,
      value: resolveBarVolume(bar),
      color: up ? volumeUp : volumeDown,
    });
  }

  return { candles, volumes };
}
