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
  intraday: boolean;
  /** Yahoo rejects some interval+range pairs — try these if the primary fails. */
  fallbacks?: Array<{ interval: string; range: string }>;
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
    range: "1mo",
    fallbacks: [{ interval: "5m", range: "5d" }],
    intraday: true,
    defaultVisibleBars: 78,
    historyChunkSec: 30 * 24 * 3600,
  },
  {
    id: "1W",
    label: "1W",
    interval: "30m",
    range: "1mo",
    fallbacks: [
      { interval: "1h", range: "3mo" },
      { interval: "15m", range: "5d" },
    ],
    intraday: true,
    defaultVisibleBars: 130,
    historyChunkSec: 60 * 24 * 3600,
  },
  {
    id: "1M",
    label: "1M",
    interval: "1d",
    range: "6mo",
    intraday: false,
    defaultVisibleBars: 90,
    historyChunkSec: 180 * 24 * 3600,
  },
  {
    id: "3M",
    label: "3M",
    interval: "1d",
    range: "2y",
    intraday: false,
    defaultVisibleBars: 120,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "6M",
    label: "6M",
    interval: "1d",
    range: "5y",
    intraday: false,
    defaultVisibleBars: 150,
    historyChunkSec: 365 * 24 * 3600,
  },
  {
    id: "1Y",
    label: "1Y",
    interval: "1d",
    range: "5y",
    intraday: false,
    defaultVisibleBars: 200,
    historyChunkSec: 2 * 365 * 24 * 3600,
  },
  {
    id: "5Y",
    label: "5Y",
    interval: "1wk",
    range: "max",
    intraday: false,
    defaultVisibleBars: 260,
    historyChunkSec: 5 * 365 * 24 * 3600,
  },
];

export function getTimeframe(id: string): ChartTimeframe {
  return (
    CHART_TIMEFRAMES.find((t) => t.id === id) ?? CHART_TIMEFRAMES[0]
  );
}
