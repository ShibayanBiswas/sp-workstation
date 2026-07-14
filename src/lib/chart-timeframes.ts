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
    range: "5d",
    inceptionRange: "60d",
    fallbacks: [{ interval: "5m", range: "1mo" }],
    inceptionFallbacks: [
      { interval: "15m", range: "60d" },
      { interval: "1h", range: "1y" },
      { interval: "1d", range: "max" },
    ],
    intraday: true,
    axisLabelMode: "time",
    defaultVisibleBars: 78,
    historyChunkSec: 60 * 24 * 3600,
  },
  {
    id: "1W",
    label: "1W",
    interval: "30m",
    range: "1mo",
    inceptionRange: "1y",
    fallbacks: [
      { interval: "1h", range: "3mo" },
      { interval: "15m", range: "5d" },
    ],
    inceptionFallbacks: [
      { interval: "1h", range: "2y" },
      { interval: "1d", range: "max" },
    ],
    intraday: true,
    axisLabelMode: "day",
    defaultVisibleBars: 130,
    historyChunkSec: 120 * 24 * 3600,
  },
  {
    id: "1M",
    label: "1M",
    interval: "1d",
    range: "6mo",
    inceptionRange: "max",
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
    inceptionRange: "max",
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
    inceptionRange: "max",
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
    inceptionRange: "max",
    intraday: false,
    axisLabelMode: "date",
    defaultVisibleBars: 200,
    historyChunkSec: 2 * 365 * 24 * 3600,
  },
  {
    id: "5Y",
    label: "5Y",
    interval: "1wk",
    range: "max",
    inceptionRange: "max",
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
