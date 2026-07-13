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
  range: string;
  intraday: boolean;
};

export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  { id: "1D", label: "1D", interval: "5m", range: "1d", intraday: true },
  { id: "1W", label: "1W", interval: "15m", range: "5d", intraday: true },
  { id: "1M", label: "1M", interval: "1d", range: "1mo", intraday: false },
  { id: "3M", label: "3M", interval: "1d", range: "3mo", intraday: false },
  { id: "6M", label: "6M", interval: "1d", range: "6mo", intraday: false },
  { id: "1Y", label: "1Y", interval: "1d", range: "1y", intraday: false },
  { id: "5Y", label: "5Y", interval: "1wk", range: "5y", intraday: false },
];

export function getTimeframe(id: string): ChartTimeframe {
  return (
    CHART_TIMEFRAMES.find((t) => t.id === id) ?? CHART_TIMEFRAMES[0]
  );
}
