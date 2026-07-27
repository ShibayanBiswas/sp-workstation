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
  type ChartTimeframeId,
} from "@/lib/chart-timeframes";
import {
  createDayAxisTickFormatter,
  formatIstDateTime,
  formatIstHeaderTime,
  istDateString,
  timeToUnix,
} from "@/lib/chart-ist";
import {
  buildHighLowMarkers,
  computeBollingerBands,
  computeSessionVwapSeries,
  findPeriodExtremes,
  formatVolumeShort,
} from "@/lib/chart-indicators";
import { buildChartSeries, barToChartTime, resolveBarVolume } from "@/lib/chart-series";
import {
  applyLiveCloseToBars,
  snapFormingBarTip,
  yahooIntervalSeconds,
  type OhlcBar,
} from "@/lib/yahoo-ohlc";
import { refreshIntervalForStatus } from "@/lib/live-refresh";
import { CLIENT_API_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { lastSessionPhrase } from "@/data/indian-markets";
import {
  getNseMarketStatus,
  isAwaitingTodayPrint,
  isInstrumentSessionLive,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  computeTimeframeReturn,
  returnBasisLabel,
  timeframeViewBars,
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

/** Sole SMA on charts — Bollinger middle band uses the same length. */
const SMA_PERIOD = 5;
const BOLLINGER_MULT = 2;

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
      volumeUp: "rgba(38, 166, 154, 0.72)",
      volumeDown: "rgba(239, 83, 80, 0.72)",
      muted: "#787b86",
      watermark: "rgba(255, 255, 255, 0.045)",
      vwap: "#b388ff",
      sma: "#f0b429",
      bb: "#42a5f5",
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
    volumeUp: "rgba(8, 153, 129, 0.65)",
    volumeDown: "rgba(242, 54, 69, 0.65)",
    muted: "#787b86",
    watermark: "rgba(19, 23, 34, 0.055)",
    vwap: "#7b1fa2",
    sma: "#c98500",
    bb: "#1e88e5",
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
  barCount: number,
  opts?: { fixEdges?: boolean }
) {
  const scaleWidth = 72;
  const width = Math.max(container.clientWidth - scaleWidth, 200);
  const spacing = Math.max(4, Math.min(14, width / Math.max(barCount, 1)));
  const fixEdges = opts?.fixEdges !== false;
  chart.applyOptions({
    timeScale: {
      rightOffset: 0,
      fixLeftEdge: fixEdges,
      fixRightEdge: fixEdges,
      barSpacing: spacing,
    },
  });
  chart.timeScale().fitContent();
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Smoothly morph the visible logical window (Zoom On/Off transitions). */
function animateLogicalRange(
  chart: IChartApi,
  targetFrom: number,
  targetTo: number,
  opts?: { durationMs?: number; isCancelled?: () => boolean }
): Promise<void> {
  const durationMs = opts?.durationMs ?? 520;
  const current = chart.timeScale().getVisibleLogicalRange();
  if (!current || durationMs <= 0) {
    chart.timeScale().setVisibleLogicalRange({
      from: targetFrom,
      to: targetTo,
    });
    return Promise.resolve();
  }

  const startFrom = current.from;
  const startTo = current.to;
  if (
    Math.abs(startFrom - targetFrom) < 0.2 &&
    Math.abs(startTo - targetTo) < 0.2
  ) {
    chart.timeScale().setVisibleLogicalRange({
      from: targetFrom,
      to: targetTo,
    });
    return Promise.resolve();
  }

  // Unlock edges so the animated window can move freely.
  chart.applyOptions({
    timeScale: { fixLeftEdge: false, fixRightEdge: false },
  });

  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      if (opts?.isCancelled?.()) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / durationMs);
      const e = easeOutCubic(t);
      chart.timeScale().setVisibleLogicalRange({
        from: startFrom + (targetFrom - startFrom) * e,
        to: startTo + (targetTo - startTo) * e,
      });
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
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
  const instrumentLive = isInstrumentSessionLive(
    marketStatus,
    syncedQuote?.marketTime
  );
  const awaitingPrint = isAwaitingTodayPrint(
    marketStatus,
    syncedQuote?.marketTime
  );
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

  // Headline Δ / % always vs active period open for the selected timeframe.
  const livePeriod =
    syncedQuote?.price != null &&
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
  const basisHint = returnBasisLabel(
    returnBasis ?? (timeframe === "1D" ? "day_open" : null)
  );
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
        scaleMargins: { top: 0.08, bottom: 0.32 },
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
    // Leave the bottom third for the volume overlay (TradingView pattern).
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.32 },
    });

    // Blank priceScaleId = overlay on the same pane (not a separate "vol" scale).
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.72, bottom: 0 },
    });

    // Overlays after candles so indicators paint on top (TradingView-style).
    const smaSeries = chart.addLineSeries({
      color: colors.sma,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: `SMA ${SMA_PERIOD}`,
    });
    const bbUpperSeries = chart.addLineSeries({
      color: colors.bb,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: "BB Upper",
    });
    const bbLowerSeries = chart.addLineSeries({
      color: colors.bb,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: "BB Lower",
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
        vwap?: number | null;
        sma?: number | null;
        bbUpper?: number | null;
        bbLower?: number | null;
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

      const volHtml = item(
        "Vol",
        formatVolumeShort(resolveBarVolume({
          time: 0,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: extras?.volume ?? undefined,
        })),
        colors.text
      );

      const smaHtml =
        extras?.sma != null
          ? item(`SMA ${SMA_PERIOD}`, fmt(extras.sma), colors.sma)
          : "";
      const bbHtml =
        extras?.bbUpper != null && extras?.bbLower != null
          ? `${item("BB U", fmt(extras.bbUpper), colors.bb)}${item("BB L", fmt(extras.bbLower), colors.bb)}`
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
          ${smaHtml}
          ${bbHtml}
          ${vwapHtml}
        </div>`;
    };

    const updateOverlayLines = (bars: OhlcBar[]) => {
      const bb = computeBollingerBands(
        bars,
        SMA_PERIOD,
        BOLLINGER_MULT,
        tf.intraday
      );
      // Middle band is SMA 5 — single SMA line for all timeframes.
      smaSeries.setData(bb.middle);
      bbUpperSeries.setData(bb.upper);
      bbLowerSeries.setData(bb.lower);

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
        vwap?: number | null;
        sma?: number | null;
        bbUpper?: number | null;
        bbLower?: number | null;
      }
    ) => {
      const bar = barsRef.current[barIndex];
      const prev = barIndex > 0 ? barsRef.current[barIndex - 1] : null;

      let sma = seriesExtras?.sma ?? null;
      let bbUpper = seriesExtras?.bbUpper ?? null;
      let bbLower = seriesExtras?.bbLower ?? null;

      // Fallback when crosshair is idle — derive SMA 5 / BB from loaded bars.
      if (
        (sma == null || bbUpper == null || bbLower == null) &&
        barIndex >= SMA_PERIOD - 1 &&
        barsRef.current.length >= SMA_PERIOD
      ) {
        const window = barsRef.current.slice(
          barIndex - SMA_PERIOD + 1,
          barIndex + 1
        );
        const mean =
          window.reduce((acc, b) => acc + b.close, 0) / SMA_PERIOD;
        let sq = 0;
        for (const b of window) {
          const d = b.close - mean;
          sq += d * d;
        }
        const sigma = Math.sqrt(sq / SMA_PERIOD);
        sma = sma ?? mean;
        bbUpper = bbUpper ?? mean + BOLLINGER_MULT * sigma;
        bbLower = bbLower ?? mean - BOLLINGER_MULT * sigma;
      }

      return {
        volume: bar?.volume ?? null,
        prevClose: prev?.close ?? null,
        vwap: seriesExtras?.vwap ?? null,
        sma,
        bbUpper,
        bbLower,
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
      } else {
        fitChartFullWidth(chart, container, candles.length);
      }

      lastCandle = candles[candles.length - 1];
      lastUnix = bars[bars.length - 1].time;
      lastBarIndex = bars.length - 1;
      renderLegend(
        lastCandle,
        lastUnix,
        legendExtrasForBar(lastBarIndex)
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
    const loadAllHistory = async (isCancelled?: () => boolean) => {
      let guard = 0;
      while (
        alive &&
        zoomRef.current &&
        hasMoreRef.current &&
        guard < 40 &&
        !isCancelled?.()
      ) {
        const before = barsRef.current.length;
        const earliest = barsRef.current[0]?.time;
        if (!earliest) break;
        await loadOlderHistory();
        if (barsRef.current.length <= before) break;
        guard += 1;
      }
      if (
        !alive ||
        !zoomRef.current ||
        barsRef.current.length === 0 ||
        isCancelled?.()
      ) {
        return;
      }
      const count = barCountRef.current;
      const range = chart.timeScale().getVisibleLogicalRange();
      // Expand gently to full history instead of a hard fit jump.
      if (range && range.from > 1.5) {
        await animateLogicalRange(chart, 0, count + 0.35, {
          durationMs: 580,
          isCancelled,
        });
        if (isCancelled?.()) return;
        chart.applyOptions(chartInteractionOptions(true));
      } else {
        fitChartFullWidth(chart, container, count, { fixEdges: false });
        chart.applyOptions(chartInteractionOptions(true));
      }
    };

    /**
     * Seamless Zoom On/Off: animate the viewport, keep candles warm,
     * and restore cached history when toggling back On.
     */
    let zoomAnimToken = 0;
    const historyCache: { bars: OhlcBar[] | null } = { bars: null };

    const applyZoomMode = (enabled: boolean) => {
      const token = ++zoomAnimToken;
      const isCancelled = () => !alive || token !== zoomAnimToken;

      chart.applyOptions(chartInteractionOptions(enabled));
      const count = barCountRef.current;
      if (count <= 0) return;

      if (!enabled) {
        // Remember extended history so Zoom On can restore without a blank gap.
        if (barsRef.current.length > 0) {
          historyCache.bars = barsRef.current.slice();
        }
        const period = timeframeViewBars(barsRef.current, tf.id);
        if (period.length === 0) return;

        const startTime = period[0]!.time;
        let fromIdx = barsRef.current.findIndex((b) => b.time >= startTime);
        if (fromIdx < 0) fromIdx = 0;
        const toIdx = Math.max(fromIdx + 1, barsRef.current.length);

        void (async () => {
          await animateLogicalRange(chart, fromIdx, toIdx + 0.25, {
            durationMs: 520,
            isCancelled,
          });
          if (isCancelled()) return;

          // Remap period bars to 0…N and settle the window without a hard jump.
          applyBars(period);
          chart.timeScale().setVisibleLogicalRange({
            from: 0,
            to: Math.max(period.length - 1, 1) + 0.25,
          });
          fitChartFullWidth(chart, container, period.length, {
            fixEdges: true,
          });
          chart.applyOptions(chartInteractionOptions(false));
        })();
        return;
      }

      // Zoom On — unlock first, restore cache under the current window, then expand.
      hasMoreRef.current = true;
      historyExhaustedRef.current = false;

      void (async () => {
        const cached = historyCache.bars;
        const periodLen = barsRef.current.length;

        if (cached && cached.length > periodLen + 2) {
          const startIdx = Math.max(0, cached.length - periodLen);
          const { candles, volumes } = buildChartSeries(
            cached,
            tf.intraday,
            colors.volumeUp,
            colors.volumeDown
          );
          candleSeries.setData(candles);
          volumeSeries.setData(volumes);
          barsRef.current = cached;
          barCountRef.current = candles.length;
          updateOverlayLines(cached);

          // Keep the same visual window (former period) while history sits to the left.
          chart.timeScale().setVisibleLogicalRange({
            from: startIdx,
            to: cached.length + 0.25,
          });

          await animateLogicalRange(chart, 0, cached.length + 0.35, {
            durationMs: 640,
            isCancelled,
          });
          if (isCancelled()) return;
        } else {
          // No cache yet — hold the period view while older bars stream in.
          chart.applyOptions({
            timeScale: {
              fixLeftEdge: false,
              fixRightEdge: false,
              rightOffset: 6,
            },
          });
        }

        if (isCancelled()) return;
        await loadAllHistory(isCancelled);
      })();
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
      fitChartFullWidth(chart, container, count);
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
        // Zoom Off: always clip to this timeframe's period from its start.
        if (!zoomRef.current) {
          incoming = timeframeViewBars(incoming, tf.id);
        }

        if (silent && barsRef.current.length > 0) {
          let merged = mergeBars(barsRef.current, incoming, intervalSec);
          if (!zoomRef.current) {
            merged = timeframeViewBars(merged, tf.id);
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
      } catch (err) {
        console.error("[CandlestickChart] load failed", err);
        if (!silent && alive) {
          const detail =
            err instanceof Error && err.message
              ? err.message
              : "Failed to load chart data.";
          setError(detail);
        }
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
      const vwapPt = param.seriesData.get(vwapSeries) as
        | LineData<Time>
        | undefined;
      const smaPt = param.seriesData.get(smaSeries) as
        | LineData<Time>
        | undefined;
      const bbUpperPt = param.seriesData.get(bbUpperSeries) as
        | LineData<Time>
        | undefined;
      const bbLowerPt = param.seriesData.get(bbLowerSeries) as
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
        vwap: vwapPt?.value ?? null,
        sma: smaPt?.value ?? null,
        bbUpper: bbUpperPt?.value ?? null,
        bbLower: bbLowerPt?.value ?? null,
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
      if (!zoomRef.current && barCountRef.current > 0) {
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
            {timeframe === "1D" ? " · VWAP" : ""}
            {" · SMA 5 · BB"}
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
