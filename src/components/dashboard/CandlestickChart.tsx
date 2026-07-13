"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getTimeframe,
  type ChartTimeframe,
  type ChartTimeframeId,
} from "@/lib/chart-timeframes";
import {
  createDayAxisTickFormatter,
  formatIstDateTime,
  formatIstHeaderTime,
  timeToUnix,
} from "@/lib/chart-ist";
import { buildChartSeries } from "@/lib/chart-series";
import { LIVE_REFRESH_MS } from "@/lib/live-refresh";
import {
  formatMarketChange,
  formatMarketChangePercent,
  formatMarketPrice,
  formatIstSyncTime,
} from "@/lib/market-quote";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

type ThemeMode = "light" | "dark";

type SyncedQuote = {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketTime?: number;
};

type Props = {
  indexId: string;
  timeframe: ChartTimeframeId;
  theme: ThemeMode;
  name: string;
  zoomEnabled?: boolean;
  fallbackPrice?: number | null;
  fallbackChange?: number | null;
  fallbackChangePercent?: number | null;
  syncedQuote?: SyncedQuote | null;
  syncedAsOf?: string;
};

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

function shouldShowRecentWindow(zoomEnabled: boolean, tf: ChartTimeframe) {
  return zoomEnabled || tf.intraday;
}

function chartColors(theme: ThemeMode) {
  if (theme === "dark") {
    return {
      bg: "#0e0e10",
      text: "#d1d4dc",
      grid: "rgba(255,255,255,0.06)",
      border: "rgba(229,207,148,0.12)",
      crosshair: "#758696",
      up: "#26a69a",
      down: "#ef5350",
      volumeUp: "rgba(38, 166, 154, 0.45)",
      volumeDown: "rgba(239, 83, 80, 0.45)",
      muted: "#787b86",
    };
  }
  return {
    bg: "#ffffff",
    text: "#131722",
    grid: "rgba(42, 46, 57, 0.08)",
    border: "rgba(0, 0, 0, 0.08)",
    crosshair: "#9598a1",
    up: "#089981",
    down: "#f23645",
    volumeUp: "rgba(8, 153, 129, 0.4)",
    volumeDown: "rgba(242, 54, 69, 0.4)",
    muted: "#787b86",
  };
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function chartInteractionOptions(zoomEnabled: boolean) {
  return {
    handleScroll: {
      mouseWheel: zoomEnabled,
      pressedMouseMove: zoomEnabled,
      horzTouchDrag: zoomEnabled,
      vertTouchDrag: zoomEnabled,
    },
    handleScale: {
      axisPressedMouseMove: zoomEnabled,
      mouseWheel: zoomEnabled,
      pinch: zoomEnabled,
    },
    timeScale: {
      fixLeftEdge: !zoomEnabled,
      fixRightEdge: !zoomEnabled,
    },
  };
}

function fitChartFullWidth(
  chart: IChartApi,
  container: HTMLDivElement,
  barCount: number
) {
  const scaleWidth = 72;
  const width = Math.max(container.clientWidth - scaleWidth, 200);
  const spacing = Math.max(4, Math.min(14, width / Math.max(barCount, 1)));
  chart.applyOptions({
    timeScale: {
      rightOffset: 0,
      fixLeftEdge: true,
      fixRightEdge: true,
      barSpacing: spacing,
    },
  });
  chart.timeScale().fitContent();
}

function showRecentWindow(
  chart: IChartApi,
  barCount: number,
  tf: ChartTimeframe
) {
  const visible = Math.min(tf.defaultVisibleBars, Math.max(barCount - 1, 1));
  chart.applyOptions({
    timeScale: {
      fixLeftEdge: false,
      fixRightEdge: false,
      barSpacing: 8,
      rightOffset: 8,
    },
  });
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(barCount - visible, 0),
    to: barCount + 2,
  });
}

function mergeBars(existing: OhlcBar[], incoming: OhlcBar[]): OhlcBar[] {
  const byTime = new Map<number, OhlcBar>();
  for (const bar of incoming) byTime.set(bar.time, bar);
  for (const bar of existing) byTime.set(bar.time, bar);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function CandlestickChart({
  indexId,
  timeframe,
  theme,
  name,
  zoomEnabled = false,
  fallbackPrice,
  fallbackChange,
  fallbackChangePercent,
  syncedQuote,
  syncedAsOf,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const zoomRef = useRef(zoomEnabled);
  const tfRef = useRef(getTimeframe(timeframe));
  const barsRef = useRef<OhlcBar[]>([]);
  const hasMoreRef = useRef(true);
  const loadingHistoryRef = useRef(false);
  const barCountRef = useRef(0);
  const prevPriceRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [priceFlash, setPriceFlash] = useState(false);

  const [header, setHeader] = useState({
    price: "—",
    change: "—",
    changePercent: "—",
    up: true,
    asOf: "",
    hoverTime: "",
  });

  const displayPrice =
    syncedQuote?.price != null
      ? formatMarketPrice(syncedQuote.price, indexId)
      : header.price !== "—"
        ? header.price
        : fallbackPrice != null
          ? formatMarketPrice(fallbackPrice, indexId)
          : "—";
  const displayUp =
    syncedQuote?.change != null
      ? syncedQuote.change >= 0
      : header.price !== "—"
        ? header.up
        : (fallbackChange ?? 0) >= 0;
  const displayChange =
    syncedQuote?.change != null
      ? formatMarketChange(syncedQuote.change, indexId)
      : header.change !== "—"
        ? header.change
        : fallbackChange != null
          ? formatMarketChange(fallbackChange, indexId)
          : "—";
  const displayChangePct =
    syncedQuote?.changePercent != null
      ? formatMarketChangePercent(syncedQuote.changePercent)
      : header.changePercent !== "—"
        ? header.changePercent
        : fallbackChangePercent != null
          ? formatMarketChangePercent(fallbackChangePercent)
          : "—";

  useEffect(() => {
    if (syncedQuote?.price == null) return;
    const newPrice = syncedQuote.price;
    if (
      prevPriceRef.current != null &&
      prevPriceRef.current !== newPrice
    ) {
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 700);
    }
    prevPriceRef.current = newPrice;
  }, [syncedQuote]);

  useEffect(() => {
    zoomRef.current = zoomEnabled;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    chart.applyOptions(chartInteractionOptions(zoomEnabled));
    const count = barCountRef.current;
    if (count > 0) {
      if (shouldShowRecentWindow(zoomEnabled, tfRef.current)) {
        showRecentWindow(chart, count, tfRef.current);
      } else {
        fitChartFullWidth(chart, container, count);
      }
    }
  }, [zoomEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    const tf = getTimeframe(timeframe);
    tfRef.current = tf;
    const colors = chartColors(theme);
    barsRef.current = [];
    hasMoreRef.current = true;
    loadingHistoryRef.current = false;
    barCountRef.current = 0;

    const axisTickFormatter = createDayAxisTickFormatter(tf.axisLabelMode);

    const chart = createChart(container, {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
        fontFamily: TV_FONT,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: colors.grid, style: LineStyle.Solid },
        horzLines: { color: colors.grid, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.06, bottom: 0.24 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        fixLeftEdge: !zoomRef.current,
        fixRightEdge: !zoomRef.current,
        tickMarkMaxCharacterLength: tf.axisLabelMode === "day" ? 8 : 10,
        tickMarkFormatter: (time: Time) =>
          axisTickFormatter(timeToUnix(time)),
      },
      localization: {
        locale: "en-IN",
        dateFormat: "dd MMM 'yy",
        timeFormatter: (time: Time) =>
          `${formatIstDateTime(timeToUnix(time), tf.axisLabelMode)} IST`,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: colors.crosshair,
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: colors.muted,
        },
        horzLine: {
          color: colors.crosshair,
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: colors.muted,
        },
      },
      handleScroll: chartInteractionOptions(zoomRef.current).handleScroll,
      handleScale: chartInteractionOptions(zoomRef.current).handleScale,
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: false,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    let lastCandle: CandlestickData<Time> | null = null;
    let lastUnix = 0;

    const renderLegend = (
      bar: { open: number; high: number; low: number; close: number } | null,
      hoverUnix: number
    ) => {
      const el = legendRef.current;
      if (!el || !bar) return;
      const up = bar.close >= bar.open;
      const priceColor = up ? colors.up : colors.down;
      const item = (label: string, value: string) =>
        `<span style="color:${colors.muted}">${label}</span>&nbsp;<span style="color:${priceColor};font-weight:600">${value}</span>`;
      const timeLabel =
        hoverUnix > 0 ? formatIstDateTime(hoverUnix, tf.axisLabelMode) : "";
      el.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-family:${TV_FONT};font-size:12px">
          ${timeLabel ? `<span style="color:${colors.muted}">${timeLabel} IST</span>` : ""}
          ${item("O", fmt(bar.open))}
          ${item("H", fmt(bar.high))}
          ${item("L", fmt(bar.low))}
          ${item("C", fmt(bar.close))}
        </div>`;
    };

    const applyBars = (
      bars: OhlcBar[],
      opts: { preserveRange?: boolean; prependCount?: number } = {}
    ) => {
      const visibleRange = opts.preserveRange
        ? chart.timeScale().getVisibleLogicalRange()
        : null;

      const { candles, volumes } = buildChartSeries(
        bars,
        tf.intraday,
        colors.volumeUp,
        colors.volumeDown
      );

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      barsRef.current = bars;
      barCountRef.current = candles.length;

      if (candles.length === 0) return;

      if (opts.prependCount && opts.prependCount > 0 && visibleRange) {
        chart.timeScale().setVisibleLogicalRange({
          from: visibleRange.from + opts.prependCount,
          to: visibleRange.to + opts.prependCount,
        });
      } else if (opts.preserveRange && visibleRange) {
        chart.timeScale().setVisibleLogicalRange(visibleRange);
      } else if (shouldShowRecentWindow(zoomRef.current, tf)) {
        showRecentWindow(chart, candles.length, tf);
      } else {
        fitChartFullWidth(chart, container, candles.length);
      }

      lastCandle = candles[candles.length - 1];
      lastUnix = bars[bars.length - 1].time;
      renderLegend(lastCandle, lastUnix);
    };

    const loadOlderHistory = async () => {
      if (
        !alive ||
        !zoomRef.current ||
        loadingHistoryRef.current ||
        !hasMoreRef.current
      ) {
        return;
      }
      const earliest = barsRef.current[0]?.time;
      if (!earliest) return;

      loadingHistoryRef.current = true;
      try {
        const res = await fetch(
          `/api/chart?indexId=${encodeURIComponent(indexId)}&timeframe=${encodeURIComponent(timeframe)}&before=${earliest}`,
          { cache: "no-store", credentials: "include" }
        );
        const data = await res.json();
        if (!alive || !res.ok || !data.bars?.length) {
          hasMoreRef.current = false;
          return;
        }

        const older = data.bars as OhlcBar[];
        const merged = mergeBars(barsRef.current, older);
        const added = merged.length - barsRef.current.length;
        if (added <= 0) {
          hasMoreRef.current = Boolean(data.hasMore);
          return;
        }

        hasMoreRef.current = Boolean(data.hasMore);
        applyBars(merged, { preserveRange: true, prependCount: added });
      } catch {
        /* ignore — user can scroll again */
      } finally {
        loadingHistoryRef.current = false;
      }
    };

    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range || !zoomRef.current) return;
      if (range.from < 30) void loadOlderHistory();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

    let pollInFlight = false;

    const loadData = async (silent: boolean) => {
      if (silent && pollInFlight) return;
      if (silent) pollInFlight = true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = await fetch(
          `/api/chart?indexId=${encodeURIComponent(indexId)}&timeframe=${encodeURIComponent(timeframe)}`,
          { cache: "no-store", credentials: "include" }
        );
        const data = await res.json();
        if (!alive) return;

        if (!res.ok || !data.bars?.length) {
          if (!silent) {
            setError(
              data.error ||
                (res.status === 401
                  ? "Session expired. Please sign in again."
                  : "Chart data unavailable. Try refreshing.")
            );
          }
          return;
        }

        hasMoreRef.current = data.hasMore !== false;
        const incoming = data.bars as OhlcBar[];

        if (silent && barsRef.current.length > 0) {
          const merged = mergeBars(barsRef.current, incoming);
          const lastIncoming = incoming[incoming.length - 1];
          const prevLast = barsRef.current[barsRef.current.length - 1];

          if (
            merged.length === barsRef.current.length &&
            lastIncoming.time === prevLast.time
          ) {
            const { candles, volumes } = buildChartSeries(
              [lastIncoming],
              tf.intraday,
              colors.volumeUp,
              colors.volumeDown
            );
            if (candles[0]) candleSeries.update(candles[0]);
            if (volumes[0]) volumeSeries.update(volumes[0]);
            barsRef.current = merged;
            lastCandle = candles[0] ?? lastCandle;
            lastUnix = lastIncoming.time;
          } else {
            applyBars(merged, { preserveRange: true });
          }
        } else {
          applyBars(incoming);
        }

        const last = data.last;
        if (last) {
          const up = (last.change ?? 0) >= 0;
          const newPrice = last.price as number | undefined;

          if (
            newPrice != null &&
            prevPriceRef.current != null &&
            prevPriceRef.current !== newPrice
          ) {
            setPriceFlash(true);
            setTimeout(() => setPriceFlash(false), 700);
          }
          if (newPrice != null) prevPriceRef.current = newPrice;

          setHeader({
            price: newPrice != null ? fmt(newPrice) : "—",
            change:
              last.change != null
                ? `${up ? "+" : ""}${fmt(last.change)}`
                : "—",
            changePercent:
              last.changePercent != null ? fmtPct(last.changePercent) : "—",
            up,
            asOf: last.time ? formatIstHeaderTime(last.time) : "",
            hoverTime: "",
          });
        }
      } catch {
        if (!silent && alive) setError("Failed to load chart data.");
      } finally {
        if (silent) pollInFlight = false;
        if (!silent && alive) setLoading(false);
      }
    };

    chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      if (!lastCandle) return;
      if (!param.time || !param.seriesData.size) {
        renderLegend(lastCandle, lastUnix);
        setHeader((h) => ({ ...h, hoverTime: "" }));
        return;
      }
      const hoverUnix = timeToUnix(param.time);
      const candle = param.seriesData.get(candleSeries) as
        | CandlestickData<Time>
        | undefined;
      renderLegend(candle ?? lastCandle, hoverUnix);
      setHeader((h) => ({
        ...h,
        hoverTime: formatIstDateTime(hoverUnix, tf.axisLabelMode),
      }));
    });

    void loadData(false);
    const pollId = setInterval(() => void loadData(true), LIVE_REFRESH_MS);

    const resizeObs = new ResizeObserver(() => {
      if (
        !shouldShowRecentWindow(zoomRef.current, tf) &&
        barCountRef.current > 0
      ) {
        fitChartFullWidth(chart, container, barCountRef.current);
      }
    });
    resizeObs.observe(container);

    return () => {
      alive = false;
      clearInterval(pollId);
      resizeObs.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      prevPriceRef.current = null;
      barsRef.current = [];
      barCountRef.current = 0;
    };
  }, [indexId, timeframe, theme, reloadKey]);

  return (
    <div className="flex flex-col bg-[var(--bg-elevated)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 md:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
            {name.toUpperCase()}
          </p>
          <div
            className={`mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md px-1 ${priceFlash ? "price-flash" : ""}`}
          >
            <span
              className={`tv-num text-[26px] font-semibold leading-none md:text-[32px] ${displayUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {displayPrice}
            </span>
            <span
              className={`tv-num text-sm font-medium ${displayUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {displayChange} ({displayChangePct})
            </span>
          </div>
          <p className="tv-num mt-1 text-[11px] text-[var(--fg-subtle)]">
            {header.hoverTime
              ? `${header.hoverTime} IST`
              : syncedQuote?.marketTime
                ? `Synced · ${formatIstHeaderTime(syncedQuote.marketTime)} IST`
                : syncedAsOf
                  ? `Synced · ${formatIstSyncTime(syncedAsOf)} IST · every minute`
                  : header.asOf
                    ? `Last update · ${header.asOf} IST`
                    : "Live · refreshes every minute · axis in IST"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)]"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="relative min-h-[500px]">
        <div ref={legendRef} className="pointer-events-none absolute left-3 top-2 z-10" />
        {loading ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg-elevated)]/90">
            <Loader2
              size={22}
              className="animate-spin text-[var(--gold-deep)] dark:text-[var(--gold)]"
            />
            <p className="text-sm text-[var(--fg-subtle)]">Loading candles…</p>
          </div>
        ) : null}
        {error && !loading ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6">
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-center text-sm text-[var(--fg-muted)]">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-lg bg-[var(--bg-muted)] px-4 py-2 text-xs font-semibold text-[var(--fg)]"
            >
              Retry
            </button>
          </div>
        ) : null}
        <div ref={containerRef} className="h-[500px] w-full" />
      </div>
    </div>
  );
}
