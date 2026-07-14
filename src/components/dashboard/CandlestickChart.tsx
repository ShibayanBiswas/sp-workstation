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
  computeTimeframeReturn,
  returnBasisLabel,
  type ReturnBasis,
} from "@/lib/chart-period-return";
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
  /** Day change vs previous close from /api/markets (Snapshot / tape). */
  change?: number | null;
  changePercent?: number | null;
  previousClose?: number | null;
  marketTime?: number;
};

type Props = {
  indexId: string;
  timeframe: ChartTimeframeId;
  theme: ThemeMode;
  name: string;
  zoomEnabled?: boolean;
  /** Optional last price while chart boots — never used for change/%. */
  fallbackPrice?: number | null;
  syncedQuote?: SyncedQuote | null;
  syncedAsOf?: string;
};

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

function shouldShowRecentWindow(zoomEnabled: boolean, tf: ChartTimeframe) {
  // Zoom On → show full loaded history (toward inception).
  // Zoom Off → for intraday keep a recent trading window; daily+ fit what loaded.
  if (zoomEnabled) return false;
  return tf.intraday;
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
  const [periodReference, setPeriodReference] = useState<number | null>(null);
  const [returnBasis, setReturnBasis] = useState<ReturnBasis | null>(null);

  const displayPrice =
    syncedQuote?.price != null
      ? formatMarketPrice(syncedQuote.price, indexId)
      : header.price !== "—"
        ? header.price
        : fallbackPrice != null
          ? formatMarketPrice(fallbackPrice, indexId)
          : "—";

  // 1D: use Snapshot/tape day change (vs prev close) so both panels always match.
  // 1W+: recompute from period open reference between chart polls.
  const livePeriod =
    timeframe === "1D" &&
    syncedQuote?.price != null &&
    syncedQuote.change != null &&
    syncedQuote.changePercent != null
      ? {
          change: syncedQuote.change,
          changePercent: syncedQuote.changePercent,
        }
      : syncedQuote?.price != null &&
          periodReference != null &&
          periodReference !== 0
        ? {
            change: syncedQuote.price - periodReference,
            changePercent:
              ((syncedQuote.price - periodReference) / periodReference) * 100,
          }
        : null;

  const displayUp = livePeriod
    ? livePeriod.change >= 0
    : header.up;
  const displayChange = livePeriod
    ? formatMarketChange(livePeriod.change, indexId)
    : header.change;
  const displayChangePct = livePeriod
    ? formatMarketChangePercent(livePeriod.changePercent)
    : header.changePercent;
  const basisHint =
    timeframe === "1D"
      ? returnBasisLabel("prev_close")
      : returnBasisLabel(returnBasis);

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
    setPeriodReference(null);
    setReturnBasis(null);
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
          `/api/chart?indexId=${encodeURIComponent(indexId)}&timeframe=${encodeURIComponent(timeframe)}&before=${earliest}&full=1`,
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

    /** When Zoom turns on, keep pulling older chunks until Yahoo has no more. */
    const loadAllHistory = async () => {
      let guard = 0;
      while (alive && zoomRef.current && hasMoreRef.current && guard < 40) {
        const before = barsRef.current.length;
        const earliest = barsRef.current[0]?.time;
        if (!earliest) break;
        await loadOlderHistory();
        if (barsRef.current.length <= before) break;
        guard += 1;
      }
      if (alive && zoomRef.current && barsRef.current.length > 0) {
        fitChartFullWidth(chart, container, barCountRef.current);
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
          `/api/chart?indexId=${encodeURIComponent(indexId)}&timeframe=${encodeURIComponent(timeframe)}${zoomRef.current ? "&full=1" : ""}`,
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
          if (zoomRef.current) {
            void loadAllHistory();
          }
        }

        const last = data.last;
        if (last) {
          const price =
            typeof last.price === "number" && Number.isFinite(last.price)
              ? (last.price as number)
              : null;

          let reference =
            typeof last.reference === "number" && Number.isFinite(last.reference)
              ? (last.reference as number)
              : null;

          // Client-side fallback if older responses omit reference.
          if (reference == null && price != null && barsRef.current.length > 0) {
            const computed = computeTimeframeReturn(
              barsRef.current,
              tf.id,
              price,
              typeof last.previousClose === "number" ? last.previousClose : null
            );
            if (computed) {
              reference = computed.reference;
              setReturnBasis(computed.basis);
            }
          } else if (
            last.basis === "prev_close" ||
            last.basis === "week_open" ||
            last.basis === "month_open" ||
            last.basis === "lookback_open"
          ) {
            setReturnBasis(last.basis);
          }

          if (reference != null) setPeriodReference(reference);

          const period =
            price != null && reference != null && reference !== 0
              ? {
                  change: price - reference,
                  changePercent: ((price - reference) / reference) * 100,
                }
              : last.change != null
                ? {
                    change: last.change as number,
                    changePercent: (last.changePercent as number) ?? 0,
                  }
                : null;

          const up = period ? period.change >= 0 : true;

          if (
            price != null &&
            prevPriceRef.current != null &&
            prevPriceRef.current !== price
          ) {
            setPriceFlash(true);
            setTimeout(() => setPriceFlash(false), 700);
          }
          if (price != null) prevPriceRef.current = price;

          setHeader({
            price: price != null ? fmt(price) : "—",
            change: period
              ? `${up ? "+" : ""}${fmt(period.change)}`
              : "—",
            changePercent: period ? fmtPct(period.changePercent) : "—",
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
            {basisHint ? (
              <span className="text-[10px] font-medium tracking-wide text-[var(--fg-subtle)]">
                {basisHint}
              </span>
            ) : null}
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
