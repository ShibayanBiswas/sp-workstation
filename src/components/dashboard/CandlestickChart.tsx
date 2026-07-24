"use client";

import { useEffect, useRef, useState } from "react";
import {
  CrosshairMode,
  createChart,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
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
  istDateString,
  timeToUnix,
  tradingSessionBars,
} from "@/lib/chart-ist";
import {
  buildHighLowMarkers,
  computeSessionVwapSeries,
  computeSmaSeries,
  findPeriodExtremes,
  formatVolumeShort,
} from "@/lib/chart-indicators";
import { buildChartSeries, barToChartTime } from "@/lib/chart-series";
import {
  applyLiveCloseToBars,
  snapFormingBarTip,
  yahooIntervalSeconds,
  type OhlcBar,
} from "@/lib/yahoo-ohlc";
import { refreshIntervalForStatus } from "@/lib/live-refresh";
import { CLIENT_API_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { getIndexById, lastSessionPhrase } from "@/data/indian-markets";
import {
  getNseMarketStatus,
  isAwaitingTodayPrint,
  isFxInstrumentLive,
  isInstrumentSessionLive,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  computeTimeframeReturn,
  returnBasisLabel,
  type ReturnBasis,
} from "@/lib/chart-period-return";
import {
  formatMarketChange,
  formatMarketChangePercent,
  formatMarketPrice,
  formatIstSessionStamp,
  formatIstSyncTime,
} from "@/lib/market-quote";

type ThemeMode = "light" | "dark";

type SyncedQuote = {
  price: number | null;
  /** Day change vs previous close from /api/markets (Snapshot / tape). */
  change?: number | null;
  changePercent?: number | null;
  dayOpen?: number | null;
  previousClose?: number | null;
  marketTime?: number;
  sessionPrinted?: boolean;
};

type Props = {
  indexId: string;
  timeframe: ChartTimeframeId;
  theme: ThemeMode;
  name: string;
  zoomEnabled?: boolean;
  marketStatus?: MarketStatus;
  /** Optional last price while chart boots — never used for change/%. */
  fallbackPrice?: number | null;
  syncedQuote?: SyncedQuote | null;
  syncedAsOf?: string;
};

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

const SMA_FAST = 20;
const SMA_SLOW = 50;

function shouldShowRecentWindow(zoomEnabled: boolean, tf: ChartTimeframe) {
  // Zoom On → show full loaded history (toward inception).
  // 1D Zoom Off → one session from open — fit the whole day, never clip into yesterday.
  // Other intraday (1W) → recent trading window.
  if (zoomEnabled) return false;
  if (tf.id === "1D") return false;
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
      crosshairGlow: "rgba(117, 134, 150, 0.14)",
      up: "#26a69a",
      down: "#ef5350",
      volumeUp: "rgba(38, 166, 154, 0.45)",
      volumeDown: "rgba(239, 83, 80, 0.45)",
      muted: "#787b86",
      watermark: "rgba(255, 255, 255, 0.045)",
      smaFast: "#5b9cf6",
      smaSlow: "#f0b90b",
      vwap: "#b388ff",
      refLine: "rgba(229, 207, 148, 0.75)",
      highLine: "rgba(38, 166, 154, 0.55)",
      lowLine: "rgba(239, 83, 80, 0.55)",
    };
  }
  return {
    bg: "#ffffff",
    text: "#131722",
    grid: "rgba(42, 46, 57, 0.08)",
    border: "rgba(0, 0, 0, 0.08)",
    crosshair: "#9598a1",
    crosshairGlow: "rgba(149, 152, 161, 0.12)",
    up: "#089981",
    down: "#f23645",
    volumeUp: "rgba(8, 153, 129, 0.4)",
    volumeDown: "rgba(242, 54, 69, 0.4)",
    muted: "#787b86",
    watermark: "rgba(19, 23, 34, 0.055)",
    smaFast: "#2962ff",
    smaSlow: "#ff6d00",
    vwap: "#7b1fa2",
    refLine: "rgba(180, 148, 72, 0.85)",
    highLine: "rgba(8, 153, 129, 0.55)",
    lowLine: "rgba(242, 54, 69, 0.55)",
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

function mergeBars(
  existing: OhlcBar[],
  incoming: OhlcBar[],
  intervalSec?: number | null
): OhlcBar[] {
  // Incoming wins on same timestamp so live OHLC refreshes aren't stuck stale.
  const byTime = new Map<number, OhlcBar>();
  for (const bar of existing) byTime.set(bar.time, bar);
  for (const bar of incoming) byTime.set(bar.time, bar);
  let bars = [...byTime.values()].sort((a, b) => a.time - b.time);
  if (intervalSec != null && intervalSec > 0 && intervalSec < 86_400) {
    bars = snapFormingBarTip(bars, intervalSec);
  }
  return bars;
}

function syncPriceLine(
  series: ISeriesApi<"Candlestick">,
  current: IPriceLine | null,
  price: number | null | undefined,
  options: {
    color: string;
    title: string;
    lineStyle?: LineStyle;
  }
): IPriceLine | null {
  if (price == null || !Number.isFinite(price)) {
    if (current) series.removePriceLine(current);
    return null;
  }
  if (current) {
    current.applyOptions({
      price,
      color: options.color,
      title: options.title,
      lineStyle: options.lineStyle ?? LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: true,
    });
    return current;
  }
  return series.createPriceLine({
    price,
    color: options.color,
    title: options.title,
    lineStyle: options.lineStyle ?? LineStyle.Dashed,
    lineWidth: 1,
    axisLabelVisible: true,
  });
}

export function CandlestickChart({
  indexId,
  timeframe,
  theme,
  name,
  zoomEnabled = false,
  marketStatus: marketStatusProp,
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
  const historyExhaustedRef = useRef(false);
  const loadingHistoryRef = useRef(false);
  const barCountRef = useRef(0);
  const prevPriceRef = useRef<number | null>(null);
  /** Apply Zoom On/Off without remounting — keeps candles warm. */
  const onZoomModeChangeRef = useRef<((enabled: boolean) => void) | null>(
    null
  );

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
  const [clockStatus, setClockStatus] = useState<MarketStatus>(() =>
    getNseMarketStatus()
  );
  const marketStatus = marketStatusProp ?? clockStatus;
  const isFx = getIndexById(indexId)?.group === "fx";
  const instrumentLive = isFx
    ? isFxInstrumentLive(syncedQuote?.marketTime)
    : isInstrumentSessionLive(marketStatus, syncedQuote?.marketTime);
  const awaitingPrint = isFx
    ? false
    : isAwaitingTodayPrint(marketStatus, syncedQuote?.marketTime);
  const marketStatusRef = useRef(marketStatus);

  useEffect(() => {
    marketStatusRef.current = marketStatus;
  }, [marketStatus]);

  useEffect(() => {
    if (marketStatusProp != null) return;
    const id = setInterval(() => setClockStatus(getNseMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, [marketStatusProp]);

  const displayPrice =
    syncedQuote?.price != null
      ? formatMarketPrice(syncedQuote.price, indexId)
      : header.price !== "—"
        ? header.price
        : fallbackPrice != null
          ? formatMarketPrice(fallbackPrice, indexId)
          : "—";

  // Prefer Snapshot/tape for 1D (Zerodha-style vs prev close). Other TFs use period open.
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
  // 1D headline always vs session open (today or last trading day).
  const basisHint =
    timeframe !== "1D"
      ? returnBasisLabel(returnBasis)
      : awaitingPrint
        ? "last session"
        : returnBasisLabel("day_open");
  const sessionPhrase = lastSessionPhrase(indexId);

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

    // Keep the forming candle glued to tape LTP between chart polls.
    if (timeframe !== "1D") return;
    const series = candleRef.current;
    const bars = barsRef.current;
    if (!series || bars.length === 0) return;
    const patched = applyLiveCloseToBars(bars, newPrice);
    barsRef.current = patched;
    const last = patched[patched.length - 1]!;
    const tf = getTimeframe(timeframe);
    series.update({
      time: barToChartTime(last, tf.intraday),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
  }, [syncedQuote, timeframe]);

  useEffect(() => {
    zoomRef.current = zoomEnabled;
    onZoomModeChangeRef.current?.(zoomEnabled);
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
    historyExhaustedRef.current = false;
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
      watermark: {
        visible: true,
        text: name.toUpperCase(),
        fontSize: 48,
        fontFamily: TV_FONT,
        fontStyle: "600",
        color: colors.watermark,
        horzAlign: "center",
        vertAlign: "center",
      },
      grid: {
        vertLines: { color: colors.grid, style: LineStyle.Solid },
        horzLines: { color: colors.grid, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        minimumWidth: 68,
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
        shiftVisibleRangeOnNewBar: true,
      },
      localization: {
        locale: "en-IN",
        dateFormat: "dd MMM 'yy",
        timeFormatter: (time: Time) =>
          `${formatIstDateTime(timeToUnix(time), tf.axisLabelMode)} IST`,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: colors.crosshairGlow,
          width: 4,
          style: LineStyle.Solid,
          labelBackgroundColor: colors.muted,
        },
        horzLine: {
          color: colors.crosshair,
          width: 1,
          style: LineStyle.LargeDashed,
          labelBackgroundColor: colors.muted,
        },
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      handleScroll: chartInteractionOptions(zoomRef.current).handleScroll,
      handleScale: chartInteractionOptions(zoomRef.current).handleScale,
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: true,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
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

    // Overlays after candles so MAs/VWAP paint on top (TradingView-style).
    const smaFastSeries = chart.addLineSeries({
      color: colors.smaFast,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: `SMA ${SMA_FAST}`,
    });
    const smaSlowSeries = chart.addLineSeries({
      color: colors.smaSlow,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: `SMA ${SMA_SLOW}`,
    });
    const vwapSeries = chart.addLineSeries({
      color: colors.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: "VWAP",
      visible: tf.intraday,
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    let lastCandle: CandlestickData<Time> | null = null;
    let lastUnix = 0;
    let lastBarIndex = -1;
    let referenceLine: IPriceLine | null = null;
    let highLine: IPriceLine | null = null;
    let lowLine: IPriceLine | null = null;
    let referencePrice: number | null = null;
    let referenceTitle = "Open";

    const renderLegend = (
      bar: { open: number; high: number; low: number; close: number } | null,
      hoverUnix: number,
      extras?: {
        volume?: number | null;
        prevClose?: number | null;
        smaFast?: number | null;
        smaSlow?: number | null;
        vwap?: number | null;
      }
    ) => {
      const el = legendRef.current;
      if (!el || !bar) return;
      const up = bar.close >= bar.open;
      const priceColor = up ? colors.up : colors.down;
      const item = (label: string, value: string, color = priceColor) =>
        `<span style="color:${colors.muted}">${label}</span>&nbsp;<span style="color:${color};font-weight:600">${value}</span>`;
      const timeLabel =
        hoverUnix > 0 ? formatIstDateTime(hoverUnix, tf.axisLabelMode) : "";

      let barChangeHtml = "";
      if (extras?.prevClose != null && extras.prevClose !== 0) {
        const chg = bar.close - extras.prevClose;
        const pct = (chg / extras.prevClose) * 100;
        const chgColor = chg >= 0 ? colors.up : colors.down;
        barChangeHtml = item("Δ", `${fmtPct(pct)}`, chgColor);
      }

      const volHtml =
        extras?.volume != null && extras.volume > 0
          ? item("Vol", formatVolumeShort(extras.volume), colors.text)
          : "";

      const smaFastHtml =
        extras?.smaFast != null
          ? item(`SMA${SMA_FAST}`, fmt(extras.smaFast), colors.smaFast)
          : "";
      const smaSlowHtml =
        extras?.smaSlow != null
          ? item(`SMA${SMA_SLOW}`, fmt(extras.smaSlow), colors.smaSlow)
          : "";
      const vwapHtml =
        extras?.vwap != null
          ? item("VWAP", fmt(extras.vwap), colors.vwap)
          : "";

      el.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-family:${TV_FONT};font-size:12px;padding:2px 4px;border-radius:6px;background:${theme === "dark" ? "rgba(14,14,16,0.55)" : "rgba(255,255,255,0.72)"};backdrop-filter:blur(6px)">
          ${timeLabel ? `<span style="color:${colors.muted}">${timeLabel} IST</span>` : ""}
          ${item("O", fmt(bar.open))}
          ${item("H", fmt(bar.high))}
          ${item("L", fmt(bar.low))}
          ${item("C", fmt(bar.close))}
          ${barChangeHtml}
          ${volHtml}
          ${smaFastHtml}
          ${smaSlowHtml}
          ${vwapHtml}
        </div>`;
    };

    const updateOverlayLines = (bars: OhlcBar[]) => {
      smaFastSeries.setData(computeSmaSeries(bars, SMA_FAST, tf.intraday));
      smaSlowSeries.setData(computeSmaSeries(bars, SMA_SLOW, tf.intraday));
      if (tf.intraday) {
        vwapSeries.applyOptions({ visible: true });
        vwapSeries.setData(computeSessionVwapSeries(bars, true));
      } else {
        vwapSeries.applyOptions({ visible: false });
        vwapSeries.setData([]);
      }

      const extremes = findPeriodExtremes(bars);
      highLine = syncPriceLine(candleSeries, highLine, extremes?.high, {
        color: colors.highLine,
        title: "High",
        lineStyle: LineStyle.Dotted,
      });
      lowLine = syncPriceLine(candleSeries, lowLine, extremes?.low, {
        color: colors.lowLine,
        title: "Low",
        lineStyle: LineStyle.Dotted,
      });
      referenceLine = syncPriceLine(
        candleSeries,
        referenceLine,
        referencePrice,
        {
          color: colors.refLine,
          title: referenceTitle,
          lineStyle: LineStyle.Dashed,
        }
      );

      candleSeries.setMarkers(
        buildHighLowMarkers(bars, tf.intraday, colors.up, colors.down)
      );
    };

    const legendExtrasForBar = (
      barIndex: number,
      seriesExtras?: {
        smaFast?: number | null;
        smaSlow?: number | null;
        vwap?: number | null;
      }
    ) => {
      const bar = barsRef.current[barIndex];
      const prev = barIndex > 0 ? barsRef.current[barIndex - 1] : null;
      return {
        volume: bar?.volume ?? null,
        prevClose: prev?.close ?? null,
        smaFast: seriesExtras?.smaFast ?? null,
        smaSlow: seriesExtras?.smaSlow ?? null,
        vwap: seriesExtras?.vwap ?? null,
      };
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
      updateOverlayLines(bars);

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
      lastBarIndex = bars.length - 1;
      renderLegend(
        lastCandle,
        lastUnix,
        legendExtrasForBar(lastBarIndex, {
          smaFast:
            bars.length >= SMA_FAST
              ? bars
                  .slice(-SMA_FAST)
                  .reduce((s, b) => s + b.close, 0) / SMA_FAST
              : null,
          smaSlow:
            bars.length >= SMA_SLOW
              ? bars
                  .slice(-SMA_SLOW)
                  .reduce((s, b) => s + b.close, 0) / SMA_SLOW
              : null,
        })
      );
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
          {
            cache: "no-store",
            credentials: "include",
            signal: AbortSignal.timeout(CLIENT_API_TIMEOUT_MS),
          }
        );
        const data = await res.json();
        if (!alive || !res.ok || !data.bars?.length) {
          hasMoreRef.current = false;
          historyExhaustedRef.current = true;
          return;
        }

        const older = data.bars as OhlcBar[];
        const intervalSec = yahooIntervalSeconds(tf.interval);
        const merged = mergeBars(barsRef.current, older, intervalSec);
        const added = merged.length - barsRef.current.length;
        if (added <= 0) {
          hasMoreRef.current = Boolean(data.hasMore);
          if (!hasMoreRef.current) historyExhaustedRef.current = true;
          return;
        }

        hasMoreRef.current = Boolean(data.hasMore);
        if (!hasMoreRef.current) historyExhaustedRef.current = true;
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

    /**
     * Seamless Zoom On/Off: never tear down the chart — only interaction,
     * visible window, and optional background history expansion change.
     */
    const applyZoomMode = (enabled: boolean) => {
      chart.applyOptions(chartInteractionOptions(enabled));
      const count = barCountRef.current;
      if (count <= 0) return;

      // Leaving zoom on 1D: clip back to this trading session from open.
      if (!enabled && tf.id === "1D") {
        const session = tradingSessionBars(barsRef.current, {
          fx: getIndexById(indexId)?.group === "fx",
        });
        if (session.length > 0) {
          applyBars(session);
          return;
        }
      }

      if (shouldShowRecentWindow(enabled, tf)) {
        showRecentWindow(chart, count, tf);
        return;
      }

      fitChartFullWidth(chart, container, count);
      if (enabled && !historyExhaustedRef.current) {
        void loadAllHistory();
      }
    };
    onZoomModeChangeRef.current = applyZoomMode;
    // Sync current prop in case Zoom toggled before chart finished mounting.
    applyZoomMode(zoomRef.current);

    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range || !zoomRef.current) return;
      if (range.from < 30) void loadOlderHistory();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

    const resetView = () => {
      const count = barCountRef.current;
      if (count <= 0) return;
      if (shouldShowRecentWindow(zoomRef.current, tf)) {
        showRecentWindow(chart, count, tf);
      } else {
        fitChartFullWidth(chart, container, count);
      }
    };

    const onDblClick = () => resetView();
    container.addEventListener("dblclick", onDblClick);

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
          {
            cache: "no-store",
            credentials: "include",
            signal: AbortSignal.timeout(CLIENT_API_TIMEOUT_MS),
          }
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
        const intervalSec = yahooIntervalSeconds(tf.interval);
        let incoming = data.bars as OhlcBar[];
        if (intervalSec != null && tf.intraday && intervalSec < 86_400) {
          incoming = snapFormingBarTip(incoming, intervalSec);
        }
        const livePrice =
          typeof data.last?.price === "number" &&
          Number.isFinite(data.last.price)
            ? (data.last.price as number)
            : null;
        if (livePrice != null) {
          incoming = applyLiveCloseToBars(incoming, livePrice);
        }
        // Client guard: 1D Zoom Off is always one session from that day's open.
        if (tf.id === "1D" && !zoomRef.current) {
          incoming = tradingSessionBars(incoming, {
            fx: getIndexById(indexId)?.group === "fx",
          });
        }

        if (silent && barsRef.current.length > 0) {
          let merged = mergeBars(barsRef.current, incoming, intervalSec);
          if (tf.id === "1D" && !zoomRef.current) {
            merged = tradingSessionBars(merged, {
              fx: getIndexById(indexId)?.group === "fx",
            });
          }
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
            updateOverlayLines(merged);
            lastCandle = candles[0] ?? lastCandle;
            lastUnix = lastIncoming.time;
            lastBarIndex = merged.length - 1;
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
              typeof last.dayOpen === "number" ? last.dayOpen : null
            );
            if (computed) {
              reference = computed.reference;
              setReturnBasis(computed.basis);
            }
          } else if (
            last.basis === "day_open" ||
            last.basis === "prev_close" ||
            last.basis === "week_open" ||
            last.basis === "month_open" ||
            last.basis === "lookback_open"
          ) {
            setReturnBasis(last.basis);
          }

          if (reference != null) setPeriodReference(reference);

          referencePrice = reference;
          referenceTitle =
            last.basis === "week_open"
              ? "Week open"
              : last.basis === "month_open"
                ? "Month open"
                : last.basis === "lookback_open"
                  ? "Period open"
                  : "Open";
          referenceLine = syncPriceLine(
            candleSeries,
            referenceLine,
            referencePrice,
            {
              color: colors.refLine,
              title: referenceTitle,
              lineStyle: LineStyle.Dashed,
            }
          );

          const period =
            last.basis === "day_open" &&
            typeof last.change === "number" &&
            Number.isFinite(last.change)
              ? {
                  change: last.change as number,
                  changePercent: (last.changePercent as number) ?? 0,
                }
              : price != null && reference != null && reference !== 0
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

          if (lastCandle && lastBarIndex >= 0) {
            renderLegend(
              lastCandle,
              lastUnix,
              legendExtrasForBar(lastBarIndex)
            );
          }
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
        renderLegend(
          lastCandle,
          lastUnix,
          legendExtrasForBar(lastBarIndex)
        );
        setHeader((h) => ({ ...h, hoverTime: "" }));
        return;
      }
      const hoverUnix = timeToUnix(param.time);
      const candle = param.seriesData.get(candleSeries) as
        | CandlestickData<Time>
        | undefined;
      const smaFastPt = param.seriesData.get(smaFastSeries) as
        | LineData<Time>
        | undefined;
      const smaSlowPt = param.seriesData.get(smaSlowSeries) as
        | LineData<Time>
        | undefined;
      const vwapPt = param.seriesData.get(vwapSeries) as
        | LineData<Time>
        | undefined;

      let barIndex = lastBarIndex;
      if (typeof param.time === "string") {
        const dayIdx = barsRef.current.findIndex(
          (b) => istDateString(b.time) === param.time
        );
        if (dayIdx >= 0) barIndex = dayIdx;
      } else {
        const exact = barsRef.current.findIndex((b) => b.time === hoverUnix);
        if (exact >= 0) barIndex = exact;
      }

      renderLegend(candle ?? lastCandle, hoverUnix, {
        ...legendExtrasForBar(barIndex),
        smaFast: smaFastPt?.value ?? null,
        smaSlow: smaSlowPt?.value ?? null,
        vwap: vwapPt?.value ?? null,
      });
      setHeader((h) => ({
        ...h,
        hoverTime: formatIstDateTime(hoverUnix, tf.axisLabelMode),
      }));
    });

    void loadData(false);
    let cancelled = false;
    let timeoutId = 0;
    const schedulePoll = () => {
      if (cancelled) return;
      const delay = refreshIntervalForStatus(marketStatusRef.current);
      timeoutId = window.setTimeout(() => {
        void loadData(true).finally(() => {
          if (!cancelled) schedulePoll();
        });
      }, delay);
    };
    schedulePoll();

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
      cancelled = true;
      window.clearTimeout(timeoutId);
      alive = false;
      resizeObs.disconnect();
      container.removeEventListener("dblclick", onDblClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      onZoomModeChangeRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      prevPriceRef.current = null;
      barsRef.current = [];
      barCountRef.current = 0;
    };
  }, [indexId, timeframe, theme, reloadKey, name]);

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
                ? awaitingPrint
                  ? `Awaiting today's print · ${sessionPhrase} ${formatIstSessionStamp(syncedQuote.marketTime, { forceDate: true }) || formatIstHeaderTime(syncedQuote.marketTime)} IST`
                  : `${instrumentLive ? "Synced" : sessionPhrase} · ${formatIstSessionStamp(syncedQuote.marketTime, { forceDate: !instrumentLive }) || formatIstHeaderTime(syncedQuote.marketTime)} IST`
                : syncedAsOf
                  ? instrumentLive
                    ? `Synced · ${formatIstSyncTime(syncedAsOf)} IST · every minute`
                    : awaitingPrint
                      ? `Awaiting today's print · polling for open`
                      : `${sessionPhrase} · ${formatIstSessionStamp(syncedAsOf, { forceDate: true })} IST`
                  : header.asOf
                    ? `${instrumentLive ? "Last update" : awaitingPrint ? "Awaiting open" : sessionPhrase} · ${header.asOf} IST`
                    : instrumentLive
                      ? "Live · refreshes every minute · axis in IST"
                      : awaitingPrint
                        ? "Awaiting today's print · chart shows last session · axis in IST"
                        : `Markets closed · showing ${sessionPhrase.toLowerCase()} · axis in IST`}
            {" · "}
            SMA {SMA_FAST}/{SMA_SLOW}
            {timeframe === "1D" ? " · VWAP" : ""}
            {zoomEnabled ? " · double-click resets view" : ""}
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
        <div ref={legendRef} className="pointer-events-none absolute left-3 top-2 z-10 max-w-[calc(100%-1.5rem)]" />
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
