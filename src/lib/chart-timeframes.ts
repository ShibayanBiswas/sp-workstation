import type { AxisLabelMode } from "@/lib/chart-ist";

export type ChartTimeframeId =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "5Y";

export type ChartTimeframe = {
  id: ChartTimeframeId;
  label: string;
  interval: string;
  /** Yahoo `range` for the initial historical fetch. */
  range: string;
  /**
   * Wider Yahoo range used when Zoom is On — load as much history as the
   * interval allows (toward inception / Yahoo max).
   */
  inceptionRange: string;
  intraday: boolean;
  /** X-axis and crosshair label style (independent of intraday bar filtering). */
  axisLabelMode: AxisLabelMode;
  /** Yahoo rejects some interval+range pairs — try these if the primary fails. */
  fallbacks?: Array<{ interval: string; range: string }>;
  /** Extra candidates when loading full/inception history with Zoom On. */
  inceptionFallbacks?: Array<{ interval: string; range: string }>;
  /** Bars visible when zoom/pan mode is enabled (TradingView-style window). */
  defaultVisibleBars: number;
  /** Seconds of extra history to request when scrolling left. */
  historyChunkSec: number;
};

export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  {
    id: "1D",
    label: "1D",
    interval: "5m",
    // Zoom Off: pull today (+buffer). Prefer 1d/2d so first paint is light on Vercel.
    range: "1d",
    // Zoom On keeps 5m candles — Yahoo caps ~60 trading days of 5m history.
    inceptionRange: "60d",
    fallbacks: [
      { interval: "5m", range: "2d" },
      { interval: "5m", range: "5d" },
      { interval: "5m", range: "1mo" },
    ],
    inceptionFallbacks: [
      { interval: "5m", range: "1mo" },
      { interval: "5m", range: "5d" },
    ],
    intraday: true,
    axisLabelMode: "time",
    defaultVisibleBars: 78,
    historyChunkSec: 60 * 24 * 3600,
  },
  {
    id: "1W",
    label: "1W",
    // Daily bars for the IST week — Monday Zoom Off = 1 forming candle that
    // updates through the day; Tue–Fri add one candle per session.
    interval: "1d",
    range: "6mo",
    inceptionRange: "10y",
    fallbacks: [
      { interval: "1d", range: "1y" },
      { interval: "1d", range: "2y" },
    ],
    inceptionFallbacks: [
      { interval: "1d", range: "5y" },
      { interval: "1d", range: "2y" },
    ],
    intraday: false,
    axisLabelMode: "day",
    defaultVisibleBars: 60,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "1M",
    label: "1M",
    interval: "1d",
    range: "6mo",
    inceptionRange: "10y",
    inceptionFallbacks: [
      { interval: "1d", range: "5y" },
      { interval: "1d", range: "2y" },
    ],
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 90,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "3M",
    label: "3M",
    interval: "1d",
    range: "2y",
    inceptionRange: "10y",
    inceptionFallbacks: [
      { interval: "1d", range: "5y" },
      { interval: "1d", range: "2y" },
    ],
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 120,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "6M",
    label: "6M",
    interval: "1d",
    range: "5y",
    inceptionRange: "10y",
    inceptionFallbacks: [{ interval: "1d", range: "5y" }],
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 150,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "1Y",
    label: "1Y",
    interval: "1d",
    range: "5y",
    inceptionRange: "10y",
    inceptionFallbacks: [{ interval: "1d", range: "5y" }],
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 200,
    historyChunkSec: 2 * 365 * 24 * 3600,
  },
  {
    id: "5Y",
    label: "5Y",
    interval: "1wk",
    range: "10y",
    // Prefer dense weekly 10y — Yahoo range=max often returns monthly-spaced bars.
    inceptionRange: "10y",
    inceptionFallbacks: [{ interval: "1wk", range: "5y" }],
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 260,
    historyChunkSec: 5 * 365 * 24 * 3600,
  },
];

export function getTimeframe(id: string): ChartTimeframe {
  return (
    CHART_TIMEFRAMES.find((t) => t.id === id) ?? CHART_TIMEFRAMES[0]
  );
}
