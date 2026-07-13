import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
import { istDateString } from "@/lib/chart-ist";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export function barToChartTime(bar: OhlcBar, intraday: boolean): Time {
  return (intraday ? bar.time : istDateString(bar.time)) as Time;
}

export function buildChartSeries(
  bars: OhlcBar[],
  intraday: boolean,
  volumeUp: string,
  volumeDown: string
) {
  const candles: CandlestickData<Time>[] = [];
  const volumes: HistogramData<Time>[] = [];

  for (const bar of bars) {
    const time = barToChartTime(bar, intraday);
    const up = bar.close >= bar.open;

    candles.push({
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    });

    if (bar.volume != null && bar.volume > 0) {
      volumes.push({
        time,
        value: bar.volume,
        color: up ? volumeUp : volumeDown,
      });
    }
  }

  return { candles, volumes };
}
