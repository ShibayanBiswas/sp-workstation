"use client";

import { useEffect, useRef, useState } from "react";
import {
  CrosshairMode,
  createChart,
  LineStyle,
  LineType,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { Loader2, Maximize2, Minimize2, RefreshCw } from "lucide-react";
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
  computeSmaSeries,
  findPeriodExtremes,
  formatVolumeShort,
} from "@/lib/chart-indicators";
import { buildChartSeries, barToChartTime, resolveBarVolume, dedupeBarsForChart } from "@/lib/chart-series";
import {
  applyLiveCloseToBars,
  snapFormingBarTip,
  yahooIntervalSeconds,
  type OhlcBar,
} from "@/lib/yahoo-ohlc";
import { refreshIntervalForStatus } from "@/lib/live-refresh";
import { CLIENT_API_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { cashExchangeLabel, lastSessionPhrase } from "@/data/indian-markets";
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

function extremesFromBars(bars: OhlcBar[]): {
  high: number | null;
  low: number | null;
  open: number | null;
  close: number | null;
} {
  if (bars.length === 0) {
    return { high: null, low: null, open: null, close: null };
  }
  let high = -Infinity;
  let low = Infinity;
  for (const b of bars) {
    if (b.high > high) high = b.high;
    if (b.low < low) low = b.low;
  }
  return {
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    open: bars[0]!.open,
    close: bars[bars.length - 1]!.close,
  };
}

type ThemeMode = "light" | "dark";

type SyncedQuote = {
  price: number | null;
  /** Day change vs session open from /api/markets (Snapshot / tape). */
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
  /** Fullscreen / expanded chart overlay. */
  expanded?: boolean;
  onToggleExpand?: () => void;
};

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

/** SMA lookback in candles — never shown in the UI. */
const SMA_PERIOD = 1;
/** Bollinger length (internal only — not labeled on chart). */
const BB_PERIOD = 5;
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

/** Vacant bars on the right — small forming runway (keep plot filled). */
const LIVE_RIGHT_GAP_BARS = 3;
/** Zoom On keeps a tighter trailing gap. */
const ZOOM_RIGHT_GAP_BARS = 2;
/** Right price axis — halved for the half-width chart pane. */
const PRICE_SCALE_MIN_WIDTH = 54;
/**
 * Preferred candle pitch (px). Zoom Off fits bars to the plot width so the
 * screen isn't left blank; preferred is a soft target / upper clamp for ≤6M.
 */
const TV_BAR_SPACING = 7;
const TV_BAR_SPACING_TO_6M = 9.5;
const TV_BAR_SPACING_MIN = 2;
/** Hard cap so a single early-period bar never spans the whole pane. */
const TV_BAR_SPACING_MAX = 16;

function barSpacingForTimeframe(id: ChartTimeframeId): number {
  switch (id) {
    case "1D":
    case "1W":
    case "1M":
    case "3M":
    case "6M":
      return TV_BAR_SPACING_TO_6M;
    case "1Y":
    case "5Y":
      return TV_BAR_SPACING;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Pitch that fills the plot: (width − price axis) / (bars + runway). */
function fitBarSpacing(
  container: HTMLDivElement,
  barCount: number,
  rightGap: number,
  preferred: number
): number {
  const plotW = Math.max(container.clientWidth - PRICE_SCALE_MIN_WIDTH, 80);
  const slots = Math.max(barCount + rightGap, 1);
  const fitted = plotW / slots;
  const max = Math.min(TV_BAR_SPACING_MAX, Math.max(preferred, preferred + 4));
  return Math.min(Math.max(fitted, TV_BAR_SPACING_MIN), max);
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
      // Lock left at period open in Zoom Off; never fix right — that clamps
      // rightOffset to 0 and kills the live forming-candle runway.
      fixLeftEdge: !zoomEnabled,
      fixRightEdge: false,
    },
  };
}

/** Re-assert pitch + right runway (call after any fit/range change). */
function applyThinCandleScale(
  chart: IChartApi,
  opts: { zoomEnabled: boolean; rightGap: number; barSpacing: number }
) {
  chart.timeScale().applyOptions({
    barSpacing: opts.barSpacing,
    minBarSpacing: TV_BAR_SPACING_MIN,
    rightOffset: opts.rightGap,
    fixLeftEdge: !opts.zoomEnabled,
    fixRightEdge: false,
    shiftVisibleRangeOnNewBar: true,
  });
}

/**
 * Fit candles to the chart pane + small right runway for forming bars.
 * Zoom Off anchors the left at the period start; spacing is derived from
 * container width so the plot isn't left blank.
 */
function layoutLiveChart(
  chart: IChartApi,
  container: HTMLDivElement,
  barCount: number,
  opts?: {
    zoomEnabled?: boolean;
    preserveScroll?: boolean;
    barSpacing?: number;
    timeframeId?: ChartTimeframeId;
  }
) {
  if (barCount <= 0) return;

  const zoomEnabled = opts?.zoomEnabled === true;
  const rightGap = zoomEnabled ? ZOOM_RIGHT_GAP_BARS : LIVE_RIGHT_GAP_BARS;
  const preferred =
    opts?.barSpacing ??
    (opts?.timeframeId
      ? barSpacingForTimeframe(opts.timeframeId)
      : TV_BAR_SPACING);
  // Zoom Off: fill the pane. Zoom On: keep preferred pitch after fitContent.
  const barSpacing = zoomEnabled
    ? preferred
    : fitBarSpacing(container, barCount, rightGap, preferred);
  const scaleOpts = { zoomEnabled, rightGap, barSpacing };

  applyThinCandleScale(chart, scaleOpts);
  if (opts?.preserveScroll) return;

  if (zoomEnabled) {
    chart.timeScale().fitContent();
    applyThinCandleScale(chart, { ...scaleOpts, zoomEnabled: true });
    return;
  }

  // Data window only — right vacant space comes from rightOffset, not `to`.
  const last = Math.max(barCount - 1, 0);
  chart.timeScale().setVisibleLogicalRange({
    from: -0.25,
    to: last + 0.35,
  });
  applyThinCandleScale(chart, { ...scaleOpts, zoomEnabled: false });
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
  expanded = false,
  onToggleExpand,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  /** True while cursor is on a candle (preserve CROSSHAIR readout). */
  const hoverActiveRef = useRef(false);
  /** Glue forming tip + quote OHLC/SMA/BB/VWAP to tape LTP between chart polls. */
  const applyLiveTipRef = useRef<((price: number) => void) | null>(null);
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
  const [barStats, setBarStats] = useState<{
    high: number | null;
    low: number | null;
    open: number | null;
    close: number | null;
  }>({ high: null, low: null, open: null, close: null });
  const [barReadout, setBarReadout] = useState<{
    timeLabel: string;
    open: string;
    high: string;
    low: string;
    close: string;
    up: boolean;
    changePct: string | null;
    volume: string | null;
    sma: string | null;
    bbUpper: string | null;
    bbLower: string | null;
    vwap: string | null;
    /** True only while the cursor is over a candle. */
    hovering?: boolean;
  } | null>(null);
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
  // 1D prefers tape session open so chart Yahoo open never drifts from the desk.
  const tapeDayOpen =
    timeframe === "1D" &&
    syncedQuote?.dayOpen != null &&
    Number.isFinite(syncedQuote.dayOpen) &&
    syncedQuote.dayOpen > 0
      ? syncedQuote.dayOpen
      : null;
  const effectivePeriodReference = tapeDayOpen ?? periodReference;
  const effectiveReturnBasis =
    tapeDayOpen != null ? ("day_open" as const) : returnBasis;

  const livePeriod =
    syncedQuote?.price != null &&
    effectivePeriodReference != null &&
    effectivePeriodReference !== 0
      ? {
          change: syncedQuote.price - effectivePeriodReference,
          changePercent:
            ((syncedQuote.price - effectivePeriodReference) /
              effectivePeriodReference) *
            100,
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
    effectiveReturnBasis ?? (timeframe === "1D" ? "day_open" : null)
  );
  const sessionPhrase = lastSessionPhrase(indexId);
  const exchange = cashExchangeLabel(indexId);
  const ltp =
    syncedQuote?.price != null && Number.isFinite(syncedQuote.price)
      ? syncedQuote.price
      : barStats.close;
  const periodHigh = barStats.high;
  const periodLow = barStats.low;
  const vsPrev =
    ltp != null &&
    syncedQuote?.previousClose != null &&
    syncedQuote.previousClose !== 0
      ? {
          change: ltp - syncedQuote.previousClose,
          changePercent:
            ((ltp - syncedQuote.previousClose) / syncedQuote.previousClose) *
            100,
        }
      : null;
  const sameSessionOpen =
    timeframe === "1D" &&
    effectivePeriodReference != null &&
    syncedQuote?.dayOpen != null &&
    Math.abs(effectivePeriodReference - syncedQuote.dayOpen) < 0.05;

  useEffect(() => {
    if (syncedQuote?.price == null) return;
    const newPrice = syncedQuote.price;
    let flashTimer = 0;
    if (
      prevPriceRef.current != null &&
      prevPriceRef.current !== newPrice
    ) {
      setPriceFlash(true);
      flashTimer = window.setTimeout(() => setPriceFlash(false), 700);
    }
    prevPriceRef.current = newPrice;

    // Keep forming candle + quote panel OHLC / SMA / BB / VWAP glued to tape.
    applyLiveTipRef.current?.(newPrice);

    return () => {
      if (flashTimer) window.clearTimeout(flashTimer);
    };
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
    setBarReadout(null);
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
        visible: false,
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
        scaleMargins: { top: 0.06, bottom: 0.28 },
        minimumWidth: PRICE_SCALE_MIN_WIDTH,
        entireTextOnly: false,
        ticksVisible: true,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: LIVE_RIGHT_GAP_BARS,
        fixLeftEdge: !zoomRef.current,
        fixRightEdge: false,
        barSpacing: barSpacingForTimeframe(tf.id),
        minBarSpacing: TV_BAR_SPACING_MIN,
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
      lastValueVisible: false,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });
    // Leave the bottom third for the volume overlay (TradingView pattern).
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.28 },
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
    // Titles stay empty — OHLC / SMA / BB / VWAP readouts live in the right panel.
    const smaSeries = chart.addLineSeries({
      color: colors.sma,
      lineWidth: 1,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 2,
      title: "",
    });
    const bbUpperSeries = chart.addLineSeries({
      color: colors.bb,
      lineWidth: 1,
      lineType: LineType.Curved,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 2,
      title: "",
    });
    const bbLowerSeries = chart.addLineSeries({
      color: colors.bb,
      lineWidth: 1,
      lineType: LineType.Curved,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 2,
      title: "",
    });
    const vwapSeries = chart.addLineSeries({
      color: colors.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      title: "",
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
      },
      hovering = false
    ) => {
      if (!bar) return;
      const up = bar.close >= bar.open;
      let changePct: string | null = null;
      if (extras?.prevClose != null && extras.prevClose !== 0) {
        changePct = fmtPct(
          ((bar.close - extras.prevClose) / extras.prevClose) * 100
        );
      }
      setBarReadout({
        timeLabel:
          hoverUnix > 0
            ? `${formatIstDateTime(hoverUnix, tf.axisLabelMode)} IST`
            : "",
        open: fmt(bar.open),
        high: fmt(bar.high),
        low: fmt(bar.low),
        close: fmt(bar.close),
        up,
        changePct,
        volume: formatVolumeShort(
          resolveBarVolume({
            time: 0,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: extras?.volume ?? undefined,
          })
        ),
        sma: extras?.sma != null ? fmt(extras.sma) : null,
        bbUpper: extras?.bbUpper != null ? fmt(extras.bbUpper) : null,
        bbLower: extras?.bbLower != null ? fmt(extras.bbLower) : null,
        vwap: extras?.vwap != null ? fmt(extras.vwap) : null,
        hovering,
      });
    };

    const updateOverlayLines = (bars: OhlcBar[]) => {
      const bb = computeBollingerBands(
        bars,
        BB_PERIOD,
        BOLLINGER_MULT,
        tf.intraday
      );
      // SMA is 1-candle (close trail); BB uses its own length — never labeled.
      smaSeries.setData(computeSmaSeries(bars, SMA_PERIOD, tf.intraday));
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
      let vwap = seriesExtras?.vwap ?? null;

      // Fallback when crosshair is idle — derive SMA / BB / VWAP from loaded bars.
      if (
        (sma == null || bbUpper == null || bbLower == null) &&
        barsRef.current.length > 0
      ) {
        if (sma == null && barIndex >= SMA_PERIOD - 1) {
          const window = barsRef.current.slice(
            Math.max(0, barIndex - SMA_PERIOD + 1),
            barIndex + 1
          );
          if (window.length === SMA_PERIOD) {
            sma =
              window.reduce((acc, b) => acc + b.close, 0) / SMA_PERIOD;
          }
        }
        if (
          (bbUpper == null || bbLower == null) &&
          barIndex >= BB_PERIOD - 1 &&
          barsRef.current.length >= BB_PERIOD
        ) {
          const window = barsRef.current.slice(
            barIndex - BB_PERIOD + 1,
            barIndex + 1
          );
          const mean =
            window.reduce((acc, b) => acc + b.close, 0) / BB_PERIOD;
          let sq = 0;
          for (const b of window) {
            const d = b.close - mean;
            sq += d * d;
          }
          const sigma = Math.sqrt(sq / BB_PERIOD);
          bbUpper = bbUpper ?? mean + BOLLINGER_MULT * sigma;
          bbLower = bbLower ?? mean - BOLLINGER_MULT * sigma;
        }
      }

      if (vwap == null && tf.intraday && barsRef.current.length > 0) {
        const vwapPts = computeSessionVwapSeries(
          barsRef.current.slice(0, barIndex + 1),
          true
        );
        const tip = vwapPts[vwapPts.length - 1];
        if (tip && "value" in tip && typeof tip.value === "number") {
          vwap = tip.value;
        }
      }

      return {
        volume: bar?.volume ?? null,
        prevClose: prev?.close ?? null,
        vwap,
        sma,
        bbUpper,
        bbLower,
      };
    };

    applyLiveTipRef.current = (price: number) => {
      if (!alive || !Number.isFinite(price) || price <= 0) return;
      const bars = barsRef.current;
      if (bars.length === 0) return;
      const patched = applyLiveCloseToBars(bars, price);
      const last = patched[patched.length - 1]!;
      barsRef.current = patched;
      candleSeries.update({
        time: barToChartTime(last, tf.intraday),
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      updateOverlayLines(patched);
      setBarStats(extremesFromBars(patched));
      lastCandle = {
        time: barToChartTime(last, tf.intraday),
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };
      lastUnix = last.time;
      lastBarIndex = patched.length - 1;
      if (!hoverActiveRef.current) {
        renderLegend(
          lastCandle,
          lastUnix,
          legendExtrasForBar(lastBarIndex)
        );
      }
    };

    const applyBars = (
      bars: OhlcBar[],
      opts: { preserveRange?: boolean; prependCount?: number } = {}
    ) => {
      const visibleRange = opts.preserveRange
        ? chart.timeScale().getVisibleLogicalRange()
        : null;

      const uniqueBars = dedupeBarsForChart(bars, tf.intraday);
      const { candles, volumes } = buildChartSeries(
        uniqueBars,
        tf.intraday,
        colors.volumeUp,
        colors.volumeDown
      );

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      barsRef.current = uniqueBars;
      barCountRef.current = candles.length;
      updateOverlayLines(uniqueBars);
      setBarStats(extremesFromBars(uniqueBars));

      if (candles.length === 0) return;

      if (opts.prependCount && opts.prependCount > 0 && visibleRange) {
        chart.timeScale().setVisibleLogicalRange({
          from: visibleRange.from + opts.prependCount,
          to: visibleRange.to + opts.prependCount,
        });
      } else if (opts.preserveRange && visibleRange) {
        chart.timeScale().setVisibleLogicalRange(visibleRange);
        // Keep the forming-candle runway even when preserving scroll.
        const rightGap = zoomRef.current
          ? ZOOM_RIGHT_GAP_BARS
          : LIVE_RIGHT_GAP_BARS;
        const preferred = barSpacingForTimeframe(tf.id);
        chart.timeScale().applyOptions({
          rightOffset: rightGap,
          barSpacing: zoomRef.current
            ? preferred
            : fitBarSpacing(container, candles.length, rightGap, preferred),
          minBarSpacing: TV_BAR_SPACING_MIN,
          fixRightEdge: false,
          shiftVisibleRangeOnNewBar: true,
        });
      } else {
        layoutLiveChart(chart, container, candles.length, {
          zoomEnabled: zoomRef.current,
          barSpacing: barSpacingForTimeframe(tf.id),
        });
      }

      lastCandle = candles[candles.length - 1];
      lastUnix = uniqueBars[uniqueBars.length - 1].time;
      lastBarIndex = uniqueBars.length - 1;
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
        layoutLiveChart(chart, container, count, {
          zoomEnabled: true,
          preserveScroll: true,
          barSpacing: barSpacingForTimeframe(tf.id),
        });
      } else {
        layoutLiveChart(chart, container, count, {
          zoomEnabled: true,
          barSpacing: barSpacingForTimeframe(tf.id),
        });
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

          // Remap period bars to 0…N with thin candles + right runway.
          applyBars(period);
          layoutLiveChart(chart, container, period.length, {
            zoomEnabled: false,
            barSpacing: barSpacingForTimeframe(tf.id),
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
              rightOffset: ZOOM_RIGHT_GAP_BARS,
              barSpacing: barSpacingForTimeframe(tf.id),
              minBarSpacing: TV_BAR_SPACING_MIN,
              shiftVisibleRangeOnNewBar: true,
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
      layoutLiveChart(chart, container, count, {
        zoomEnabled: zoomRef.current,
        barSpacing: barSpacingForTimeframe(tf.id),
      });
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
            setBarStats(extremesFromBars(merged));
            lastCandle = candles[0] ?? lastCandle;
            lastUnix = lastIncoming.time;
            lastBarIndex = merged.length - 1;
          } else if (
            !zoomRef.current &&
            merged.length === barsRef.current.length + 1 &&
            lastIncoming.time > prevLast.time
          ) {
            // New bar in Zoom Off — append via update so shiftVisibleRangeOnNewBar
            // slides it into the reserved right runway (keeps left at period open).
            const { candles, volumes } = buildChartSeries(
              [lastIncoming],
              tf.intraday,
              colors.volumeUp,
              colors.volumeDown
            );
            if (candles[0]) candleSeries.update(candles[0]);
            if (volumes[0]) volumeSeries.update(volumes[0]);
            barsRef.current = merged;
            barCountRef.current = merged.length;
            updateOverlayLines(merged);
            setBarStats(extremesFromBars(merged));
            lastCandle = candles[0] ?? lastCandle;
            lastUnix = lastIncoming.time;
            lastBarIndex = merged.length - 1;
            chart.timeScale().applyOptions({
              rightOffset: LIVE_RIGHT_GAP_BARS,
              barSpacing: fitBarSpacing(
                container,
                merged.length,
                LIVE_RIGHT_GAP_BARS,
                barSpacingForTimeframe(tf.id)
              ),
              minBarSpacing: TV_BAR_SPACING_MIN,
              fixRightEdge: false,
              shiftVisibleRangeOnNewBar: true,
            });
          } else {
            applyBars(merged, {
              preserveRange: zoomRef.current,
            });
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
        hoverActiveRef.current = false;
        renderLegend(
          lastCandle,
          lastUnix,
          legendExtrasForBar(lastBarIndex),
          false
        );
        setHeader((h) => ({ ...h, hoverTime: "" }));
        return;
      }
      hoverActiveRef.current = true;
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
      }, true);
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
      if (barCountRef.current > 0) {
        layoutLiveChart(chart, container, barCountRef.current, {
          zoomEnabled: zoomRef.current,
          // Zoom On: keep user's pan; Zoom Off: re-anchor period + right gap.
          preserveScroll: zoomRef.current,
          barSpacing: barSpacingForTimeframe(tf.id),
        });
      }
    });
    resizeObs.observe(container);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      alive = false;
      applyLiveTipRef.current = null;
      hoverActiveRef.current = false;
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
    <div className="live-chart-split bg-[var(--bg-elevated)]">
      <div className="live-chart-pane order-2 lg:order-1">
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-4 sm:p-6">
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
        <div ref={containerRef} className="absolute inset-0 h-full w-full touch-pan-y" />
      </div>

      <aside className="live-chart-quote order-1 lg:order-2">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 90% 55% at 100% 0%, color-mix(in srgb, var(--gold) 16%, transparent), transparent 58%), radial-gradient(ellipse 70% 50% at 0% 100%, color-mix(in srgb, var(--gold) 8%, transparent), transparent 60%)",
          }}
        />
        <div className="live-chart-quote-scroll">
          <div className="quote-block flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {exchange ? (
                <span className="shrink-0 rounded-md border border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
                  {exchange}
                </span>
              ) : null}
              <p className="truncate text-[11px] font-bold tracking-[0.16em] text-[var(--fg)]">
                {name.toUpperCase()}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${
                  instrumentLive
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : awaitingPrint
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      : "bg-[var(--bg-muted)] text-[var(--fg-subtle)]"
                }`}
              >
                {instrumentLive ? (
                  <span className="quote-live-dot" aria-hidden />
                ) : null}
                {instrumentLive
                  ? "LIVE"
                  : awaitingPrint
                    ? "OPEN SOON"
                    : marketStatus === "holiday"
                      ? "HOLIDAY"
                      : marketStatus === "weekend"
                        ? "WEEKEND"
                        : "CLOSED"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {onToggleExpand ? (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  aria-pressed={expanded}
                  title={expanded ? "Exit full chart" : "Expand chart"}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--fg-muted)] transition hover:border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] hover:text-[var(--fg)] active:scale-[0.97]"
                >
                  {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  {expanded ? "Exit" : "Expand"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--fg-muted)] transition hover:border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] hover:text-[var(--fg)] active:scale-[0.97]"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          <div
            className={`quote-block quote-hero rounded-xl border border-[color-mix(in_srgb,var(--gold)_22%,var(--border))] bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] px-2 py-1.5 backdrop-blur-sm ${priceFlash ? "price-flash" : ""}`}
          >
            <div className="relative z-[1] flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold tracking-[0.18em] text-[var(--fg-subtle)]">
                  LAST TRADED
                </p>
                <span
                  className={`tv-num mt-1 block text-[1.55rem] font-semibold leading-none tracking-tight sm:text-[1.85rem] ${displayUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {displayPrice}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`quote-change-chip tv-num rounded-md px-2.5 py-1 text-xs font-semibold ${
                    displayUp
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/12 text-red-700 dark:text-red-400"
                  }`}
                >
                  {displayChange} ({displayChangePct})
                </span>
                {basisHint ? (
                  <span className="text-[10px] font-medium text-[var(--fg-subtle)]">
                    {basisHint}
                  </span>
                ) : null}
              </div>
            </div>
            {vsPrev ? (
              <div className="relative z-[1] mt-2 flex items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] pt-2">
                <span className="text-[10px] tracking-wide text-[var(--fg-subtle)]">
                  vs prev close
                </span>
                <span
                  className={`tv-num text-xs font-semibold ${
                    vsPrev.change >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {`${formatMarketChange(vsPrev.change, indexId)} (${formatMarketChangePercent(vsPrev.changePercent)})`}
                </span>
              </div>
            ) : null}
          </div>

          <div className="quote-block rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold tracking-[0.16em] text-[var(--fg-subtle)]">
                {barReadout?.hovering ? "CROSSHAIR" : "LATEST BAR"}
              </span>
              <span className="tv-num truncate text-[10px] text-[var(--fg-muted)]">
                {barReadout?.timeLabel ||
                  (header.hoverTime
                    ? `${header.hoverTime} IST`
                    : header.asOf
                      ? `${header.asOf} IST`
                      : "—")}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {(
                [
                  ["O", barReadout?.open],
                  ["H", barReadout?.high],
                  ["L", barReadout?.low],
                  ["C", barReadout?.close],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="quote-metric rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1 py-1 text-center"
                >
                  <p className="text-[9px] font-bold tracking-wide text-[var(--fg-subtle)]">
                    {label}
                  </p>
                  <p
                    className={`tv-num mt-0.5 text-[11px] font-semibold tabular-nums ${
                      label === "C" && barReadout
                        ? barReadout.up
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                        : label === "H"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : label === "L"
                            ? "text-red-600 dark:text-red-400"
                            : "text-[var(--fg)]"
                    }`}
                  >
                    {value ?? "—"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-1.5 border-t border-[var(--border)] pt-1.5">
              <div className="flex gap-1 overflow-x-auto overscroll-x-contain scrollbar-thin pb-0.5">
                {barReadout?.changePct ? (
                  <div className="quote-metric min-w-[4.75rem] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1.5 py-1">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-[var(--fg-subtle)]">
                      Δ
                    </p>
                    <p
                      className={`tv-num mt-0.5 text-[11px] font-semibold tabular-nums ${
                        barReadout.changePct.startsWith("-")
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {barReadout.changePct}
                    </p>
                  </div>
                ) : null}
                {barReadout?.volume ? (
                  <div className="quote-metric min-w-[4.75rem] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1.5 py-1">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-[var(--fg-subtle)]">
                      VOL
                    </p>
                    <p className="tv-num mt-0.5 text-[11px] font-semibold tabular-nums text-[var(--fg)]">
                      {barReadout.volume}
                    </p>
                  </div>
                ) : null}
                {barReadout?.vwap ? (
                  <div className="quote-metric min-w-[5.5rem] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1.5 py-1">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-[var(--fg-subtle)]">
                      VWAP
                    </p>
                    <p className="tv-num mt-0.5 text-[11px] font-semibold tabular-nums text-[var(--gold-deep)] dark:text-[var(--gold)]">
                      {barReadout.vwap}
                    </p>
                  </div>
                ) : null}
                {barReadout?.sma ? (
                  <div className="quote-metric min-w-[5.5rem] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1.5 py-1">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-[var(--fg-subtle)]">
                      SMA
                    </p>
                    <p className="tv-num mt-0.5 text-[11px] font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      {barReadout.sma}
                    </p>
                  </div>
                ) : null}
                {barReadout?.bbUpper && barReadout?.bbLower ? (
                  <div className="quote-metric min-w-[9.5rem] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-1.5 py-1">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-[var(--fg-subtle)]">
                      BB
                    </p>
                    <p className="tv-num mt-0.5 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {barReadout.bbLower}
                      <span className="mx-1 text-[9px] font-medium text-[var(--fg-subtle)]">
                        —
                      </span>
                      {barReadout.bbUpper}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="quote-block grid grid-cols-2 gap-1.5">
            <div className="quote-metric rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-2 py-1">
              <p className="text-[9px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
                {sameSessionOpen || timeframe === "1D" ? "OPEN" : "PERIOD OPEN"}
              </p>
              <p className="tv-num mt-0.5 text-sm font-semibold tabular-nums text-[var(--fg)]">
                {effectivePeriodReference != null
                  ? formatMarketPrice(effectivePeriodReference, indexId)
                  : "—"}
              </p>
            </div>
            <div className="quote-metric rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-2 py-1">
              <p className="text-[9px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
                PREV CLOSE
              </p>
              <p className="tv-num mt-0.5 text-sm font-semibold tabular-nums text-[var(--fg)]">
                {syncedQuote?.previousClose != null
                  ? formatMarketPrice(syncedQuote.previousClose, indexId)
                  : "—"}
              </p>
            </div>
            <div className="quote-metric rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-2 py-1">
              <p className="text-[9px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
                HIGH
              </p>
              <p className="tv-num mt-0.5 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {periodHigh != null
                  ? formatMarketPrice(periodHigh, indexId)
                  : "—"}
              </p>
            </div>
            <div className="quote-metric rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-2 py-1">
              <p className="text-[9px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
                LOW
              </p>
              <p className="tv-num mt-0.5 text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                {periodLow != null
                  ? formatMarketPrice(periodLow, indexId)
                  : "—"}
              </p>
            </div>
            {!sameSessionOpen &&
            timeframe !== "1D" &&
            syncedQuote?.dayOpen != null ? (
              <div className="quote-metric col-span-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-2 py-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[9px] font-bold tracking-[0.14em] text-[var(--fg-subtle)]">
                    SESSION OPEN
                  </p>
                  <p className="tv-num truncate text-sm font-semibold text-[var(--fg)]">
                    {formatMarketPrice(syncedQuote.dayOpen, indexId)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="quote-grow hidden lg:block" aria-hidden />

          <div className="quote-block space-y-1 pt-0.5">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--fg-muted)] transition hover:scale-[1.03]">
                {timeframe}
              </span>
              {timeframe === "1D" ? (
                <span className="rounded-md border border-[color-mix(in_srgb,#d4a017_40%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gold-deep)] transition hover:scale-[1.03] dark:text-[var(--gold)]">
                  VWAP
                </span>
              ) : null}
              <span className="rounded-md border border-[color-mix(in_srgb,#38bdf8_35%,var(--border))] bg-[color-mix(in_srgb,#38bdf8_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-sky-800 transition hover:scale-[1.03] dark:text-sky-300">
                SMA
              </span>
              <span className="rounded-md border border-[color-mix(in_srgb,#94a3b8_40%,var(--border))] bg-[color-mix(in_srgb,#94a3b8_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-slate-700 transition hover:scale-[1.03] dark:text-slate-300">
                BB
              </span>
            </div>
            <p className="tv-num border-t border-[var(--border)] pt-1.5 text-[10px] leading-snug text-[var(--fg-subtle)]">
              {header.hoverTime
                ? `Crosshair · ${header.hoverTime} IST`
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
              {zoomEnabled ? " · double-click resets view" : ""}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
