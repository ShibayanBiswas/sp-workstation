"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineStyle,
  type CandlestickData,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getTimeframe,
  type ChartTimeframeId,
} from "@/lib/chart-timeframes";
import {
  formatIstAxisLabel,
  formatIstDateTime,
  formatIstHeaderTime,
  timeToUnix,
} from "@/lib/chart-ist";
import { buildChartSeries } from "@/lib/chart-series";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

type ThemeMode = "light" | "dark";

type Props = {
  indexId: string;
  timeframe: ChartTimeframeId;
  theme: ThemeMode;
  name: string;
  fallbackPrice?: number | null;
  fallbackChange?: number | null;
  fallbackChangePercent?: number | null;
};

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

function tvColors(theme: ThemeMode) {
  if (theme === "dark") {
    return {
      bg: "#131722",
      text: "#d1d4dc",
      grid: "#2a2e39",
      border: "#2a2e39",
      crosshair: "#758696",
      up: "#26a69a",
      down: "#ef5350",
      volumeUp: "rgba(38, 166, 154, 0.5)",
      volumeDown: "rgba(239, 83, 80, 0.5)",
      muted: "#787b86",
    };
  }
  return {
    bg: "#ffffff",
    text: "#131722",
    grid: "#e0e3eb",
    border: "#e0e3eb",
    crosshair: "#9598a1",
    up: "#089981",
    down: "#f23645",
    volumeUp: "rgba(8, 153, 129, 0.45)",
    volumeDown: "rgba(242, 54, 69, 0.45)",
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

export function CandlestickChart({
  indexId,
  timeframe,
  theme,
  name,
  fallbackPrice,
  fallbackChange,
  fallbackChangePercent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const c = tvColors(theme);

  const [header, setHeader] = useState({
    price: "—",
    change: "—",
    changePercent: "—",
    up: true,
    asOf: "",
    hoverTime: "",
  });

  const displayPrice =
    header.price !== "—"
      ? header.price
      : fallbackPrice != null
        ? fmt(fallbackPrice)
        : "—";
  const displayUp =
    header.price !== "—" ? header.up : (fallbackChange ?? 0) >= 0;
  const displayChange =
    header.change !== "—"
      ? header.change
      : fallbackChange != null
        ? `${displayUp ? "+" : ""}${fmt(fallbackChange)}`
        : "—";
  const displayChangePct =
    header.changePercent !== "—"
      ? header.changePercent
      : fallbackChangePercent != null
        ? fmtPct(fallbackChangePercent)
        : "—";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    const tf = getTimeframe(timeframe);
    const colors = tvColors(theme);

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
        scaleMargins: { top: 0.08, bottom: 0.26 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: tf.intraday ? 7 : 9,
      },
      localization: {
        locale: "en-IN",
        timeFormatter: (time: Time) =>
          formatIstAxisLabel(timeToUnix(time), tf.intraday),
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
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
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
        `<span style="color:${colors.muted};font-family:${TV_FONT}">${label}</span>&nbsp;<span style="color:${priceColor};font-weight:600;font-family:${TV_FONT}">${value}</span>`;
      const timeLabel =
        hoverUnix > 0 ? formatIstDateTime(hoverUnix, tf.intraday) : "";
      el.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-family:${TV_FONT};font-size:12px">
          ${timeLabel ? `<span style="color:${colors.muted}">${timeLabel} IST</span>` : ""}
          ${item("O", fmt(bar.open))}
          ${item("H", fmt(bar.high))}
          ${item("L", fmt(bar.low))}
          ${item("C", fmt(bar.close))}
        </div>`;
    };

    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(
          `/api/chart?indexId=${encodeURIComponent(indexId)}&timeframe=${encodeURIComponent(timeframe)}`,
          { cache: "no-store", credentials: "include" }
        );
        const data = await res.json();
        if (!alive) return;

        if (!res.ok || !data.bars?.length) {
          setError(
            data.error ||
              (res.status === 401
                ? "Session expired. Please sign in again."
                : "Chart data unavailable. Try refreshing.")
          );
          setLoading(false);
          return;
        }

        const bars = data.bars as OhlcBar[];
        const { candles, volumes } = buildChartSeries(
          bars,
          tf.intraday,
          colors.volumeUp,
          colors.volumeDown
        );

        if (candles.length === 0) {
          setError("No valid candles for this timeframe.");
          setLoading(false);
          return;
        }

        candleSeries.setData(candles);
        volumeSeries.setData(volumes);
        chart.timeScale().fitContent();

        const lastCandle = candles[candles.length - 1];
        lastUnix = bars[bars.length - 1].time;
        renderLegend(lastCandle, lastUnix);

        chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
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
            hoverTime: formatIstDateTime(hoverUnix, tf.intraday),
          }));
        });

        const last = data.last;
        const up = (last?.change ?? 0) >= 0;
        setHeader({
          price: last?.price != null ? fmt(last.price) : "—",
          change:
            last?.change != null
              ? `${up ? "+" : ""}${fmt(last.change)}`
              : "—",
          changePercent:
            last?.changePercent != null ? fmtPct(last.changePercent) : "—",
          up,
          asOf: last?.time ? formatIstHeaderTime(last.time) : "",
          hoverTime: "",
        });
      } catch {
        if (alive) setError("Failed to load chart data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      chart.remove();
    };
  }, [indexId, timeframe, theme, reloadKey]);

  return (
    <div className="flex flex-col" style={{ background: c.bg, fontFamily: TV_FONT }}>
      <div
        className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 md:px-5"
        style={{ borderBottom: `1px solid ${c.border}` }}
      >
        <div className="min-w-0">
          <p
            className="text-[13px] font-semibold"
            style={{ color: c.text, fontFamily: TV_FONT }}
          >
            {name}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span
              className="tv-num text-[26px] font-semibold leading-none md:text-[32px]"
              style={{ color: displayUp ? c.up : c.down }}
            >
              {displayPrice}
            </span>
            <span
              className="tv-num text-[14px] font-medium"
              style={{ color: displayUp ? c.up : c.down }}
            >
              {displayChange} ({displayChangePct})
            </span>
          </div>
          <p className="tv-num mt-1 text-[11px]" style={{ color: c.muted }}>
            {header.hoverTime
              ? `${header.hoverTime} IST`
              : header.asOf
                ? `Last update · ${header.asOf} IST`
                : "NSE · Indian Standard Time"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition hover:opacity-80"
          style={{ color: c.muted, fontFamily: TV_FONT }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="relative" style={{ minHeight: 500 }}>
        <div ref={legendRef} className="pointer-events-none absolute left-3 top-2 z-10" />
        {loading ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
            style={{ background: `${c.bg}ee`, fontFamily: TV_FONT }}
          >
            <Loader2 size={22} className="animate-spin" style={{ color: c.muted }} />
            <p className="text-sm" style={{ color: c.muted }}>
              Loading candles…
            </p>
          </div>
        ) : null}
        {error && !loading ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6">
            <p
              className="rounded border px-4 py-3 text-center text-sm"
              style={{
                borderColor: c.border,
                color: c.muted,
                background: c.bg,
                fontFamily: TV_FONT,
              }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded px-4 py-2 text-xs font-semibold"
              style={{ background: c.grid, color: c.text, fontFamily: TV_FONT }}
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
