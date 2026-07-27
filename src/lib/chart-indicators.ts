import type {
  LineData,
  SeriesMarker,
  Time,
  WhitespaceData,
} from "lightweight-charts";
import { barToChartTime } from "@/lib/chart-series";
import { istDateString } from "@/lib/chart-ist";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export type ChartLinePoint = LineData<Time> | WhitespaceData<Time>;

/** Simple moving average of close. */
export function computeSmaSeries(
  bars: OhlcBar[],
  period: number,
  intraday: boolean
): ChartLinePoint[] {
  if (period < 1 || bars.length === 0) return [];
  const out: ChartLinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    const time = barToChartTime(bars[i], intraday);
    if (i < period - 1) {
      out.push({ time });
    } else {
      out.push({ time, value: sum / period });
    }
  }
  return out;
}

/**
 * Bollinger Bands for the matching SMA period.
 * Middle = SMA(N); Upper/Lower = SMA ± mult × population σ of closes.
 */
export function computeBollingerBands(
  bars: OhlcBar[],
  period: number,
  mult: number,
  intraday: boolean
): {
  middle: ChartLinePoint[];
  upper: ChartLinePoint[];
  lower: ChartLinePoint[];
} {
  if (period < 1 || bars.length === 0) {
    return { middle: [], upper: [], lower: [] };
  }

  const middle: ChartLinePoint[] = [];
  const upper: ChartLinePoint[] = [];
  const lower: ChartLinePoint[] = [];
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    const time = barToChartTime(bars[i], intraday);

    if (i < period - 1) {
      middle.push({ time });
      upper.push({ time });
      lower.push({ time });
      continue;
    }

    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = bars[j].close - mean;
      sq += d * d;
    }
    const sigma = Math.sqrt(sq / period);
    middle.push({ time, value: mean });
    upper.push({ time, value: mean + mult * sigma });
    lower.push({ time, value: mean - mult * sigma });
  }

  return { middle, upper, lower };
}

/**
 * Session VWAP using typical price × volume.
 * Resets on each IST calendar day (standard intraday VWAP).
 */
export function computeSessionVwapSeries(
  bars: OhlcBar[],
  intraday: boolean
): ChartLinePoint[] {
  if (!intraday || bars.length === 0) return [];
  const out: ChartLinePoint[] = [];
  let day = "";
  let cumPv = 0;
  let cumVol = 0;

  for (const bar of bars) {
    const time = barToChartTime(bar, true);
    const barDay = istDateString(bar.time);
    if (barDay !== day) {
      day = barDay;
      cumPv = 0;
      cumVol = 0;
    }
    const vol = bar.volume ?? 0;
    if (vol <= 0) {
      out.push(cumVol > 0 ? { time, value: cumPv / cumVol } : { time });
      continue;
    }
    const typical = (bar.high + bar.low + bar.close) / 3;
    cumPv += typical * vol;
    cumVol += vol;
    out.push({ time, value: cumPv / cumVol });
  }
  return out;
}

export function findPeriodExtremes(bars: OhlcBar[]): {
  highBar: OhlcBar;
  lowBar: OhlcBar;
  high: number;
  low: number;
} | null {
  if (bars.length === 0) return null;
  let highBar = bars[0];
  let lowBar = bars[0];
  for (const bar of bars) {
    if (bar.high > highBar.high) highBar = bar;
    if (bar.low < lowBar.low) lowBar = bar;
  }
  return {
    highBar,
    lowBar,
    high: highBar.high,
    low: lowBar.low,
  };
}

export function buildHighLowMarkers(
  bars: OhlcBar[],
  intraday: boolean,
  highColor: string,
  lowColor: string
): SeriesMarker<Time>[] {
  const extremes = findPeriodExtremes(bars);
  if (!extremes) return [];
  const markers: SeriesMarker<Time>[] = [
    {
      time: barToChartTime(extremes.highBar, intraday),
      position: "aboveBar",
      shape: "arrowDown",
      color: highColor,
      text: "H",
      size: 0.8,
    },
    {
      time: barToChartTime(extremes.lowBar, intraday),
      position: "belowBar",
      shape: "arrowUp",
      color: lowColor,
      text: "L",
      size: 0.8,
    },
  ];
  // lightweight-charts requires markers ascending by time (high may be after low).
  return markers.sort((a, b) => {
    const ta = typeof a.time === "number" ? a.time : String(a.time);
    const tb = typeof b.time === "number" ? b.time : String(b.time);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

export function formatVolumeShort(volume: number): string {
  const abs = Math.abs(volume);
  if (abs >= 1e7) return `${(volume / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(volume / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return String(Math.round(volume));
}
