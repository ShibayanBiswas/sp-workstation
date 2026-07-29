"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Move } from "lucide-react";
import { INDIAN_MARKET_INDICES, indicesByGroup } from "@/data/indian-markets";
import { useMarkets } from "@/components/dashboard/MarketsProvider";
import { CandlestickChart } from "@/components/dashboard/CandlestickChart";
import { LiveSyncIndicator } from "@/components/dashboard/LiveSyncIndicator";
import {
  CHART_TIMEFRAMES,
  type ChartTimeframeId,
} from "@/lib/chart-timeframes";
import {
  isAwaitingTodayPrint,
  isInstrumentSessionLive,
  marketStatusLabel,
  type MarketStatus,
} from "@/lib/market-hours";

type ThemeMode = "light" | "dark";

function marketBadgeClass(status: MarketStatus, awaiting = false) {
  if (awaiting) {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
  switch (status) {
    case "open":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "pre-open":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "weekend":
    case "holiday":
    case "closed":
      return "bg-[var(--bg-muted)] text-[var(--fg-subtle)]";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Row 3 — candlestick chart with timeframes. */
export function LiveCharts() {
  const {
    quoteFor,
    selectedIndexId,
    setSelectedIndexId,
    asOf,
    syncing,
    lastMarketTime,
    marketStatus,
  } = useMarkets();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [timeframe, setTimeframe] = useState<ChartTimeframeId>("1D");
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const sync = () => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const active =
    INDIAN_MARKET_INDICES.find((i) => i.id === selectedIndexId) ??
    INDIAN_MARKET_INDICES[0];

  const liveQuote = quoteFor(selectedIndexId);
  const instrumentLive = isInstrumentSessionLive(
    marketStatus,
    liveQuote?.marketTime
  );
  const awaitingPrint = isAwaitingTodayPrint(
    marketStatus,
    liveQuote?.marketTime
  );
  const chartStatus = marketStatus;
  const chartSyncStatus = chartStatus;
  const chartLastMarketTime = liveQuote?.marketTime ?? lastMarketTime;

  const benchmarks = indicesByGroup("benchmark");
  const sectors = indicesByGroup("sector");
  const volatility = indicesByGroup("volatility");

  const chartNode = mounted ? (
    <CandlestickChart
      key={`${selectedIndexId}-${timeframe}`}
      indexId={selectedIndexId}
      timeframe={timeframe}
      theme={theme}
      name={active.name}
      zoomEnabled={zoomEnabled}
      marketStatus={chartStatus}
      fallbackPrice={liveQuote?.price}
      syncedQuote={
        liveQuote
          ? {
              price: liveQuote.price,
              change: liveQuote.change,
              changePercent: liveQuote.changePercent,
              dayOpen: liveQuote.dayOpen,
              previousClose: liveQuote.previousClose,
              marketTime: liveQuote.marketTime,
              sessionPrinted: liveQuote.sessionPrinted,
            }
          : null
      }
      syncedAsOf={asOf}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
    />
  ) : (
    <div className="live-chart-pane flex items-center justify-center text-sm text-[var(--fg-subtle)] lg:min-h-[560px]">
      <span className={instrumentLive ? "animate-pulse-live" : ""}>
        Preparing chart…
      </span>
    </div>
  );

  return (
    <section
      id="live-chart"
      className="panel-stable panel-luxe overflow-hidden rounded-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-2 py-1.5 sm:gap-3 sm:px-3 md:px-4">
        <div className="min-w-0">
          <p className="section-kicker">
            {instrumentLive
              ? "Live chart"
              : awaitingPrint
                ? "Awaiting open"
                : "Session chart"}
          </p>
          <h3 className="section-title truncate">{active.name}</h3>
        </div>
        <div className="relative w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:max-w-[280px]">
          <label className="sr-only" htmlFor="index-select">
            Select index
          </label>
          <select
            id="index-select"
            value={selectedIndexId}
            onChange={(e) => setSelectedIndexId(e.target.value)}
            className="input-field w-full appearance-none py-2 pr-10 text-sm"
          >
            <optgroup label="Benchmarks">
              {benchmarks.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sectors">
              {sectors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Volatility">
              {volatility.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-2 py-1.5 sm:px-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-thin">
          {CHART_TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframe(tf.id)}
              aria-pressed={timeframe === tf.id}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition sm:px-3 sm:text-xs ${
                timeframe === tf.id
                  ? "bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[var(--gold-deep)] dark:text-[var(--gold)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
              }`}
            >
              {tf.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setZoomEnabled((z) => !z)}
            aria-pressed={zoomEnabled}
            title={
              zoomEnabled
                ? "Disable pan and zoom"
                : "Enable pan, scroll, and zoom"
            }
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-[0.97] sm:px-3 sm:text-xs ${
              zoomEnabled
                ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-[var(--gold-deep)] dark:text-[var(--gold)]"
                : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
            }`}
          >
            <Move
              size={14}
              className={`transition-transform ${zoomEnabled ? "rotate-45" : ""}`}
            />
            Zoom {zoomEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LiveSyncIndicator
            syncing={syncing}
            lastSyncedAt={asOf}
            lastMarketTime={chartLastMarketTime}
            marketStatus={chartSyncStatus}
            awaitingTodayPrint={awaitingPrint}
            compact
          />
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${marketBadgeClass(chartStatus, awaitingPrint)}`}
          >
            {awaitingPrint
              ? "Awaiting open · IST"
              : `${marketStatusLabel(marketStatus)} · IST`}
          </span>
        </div>
      </div>

      {expanded ? (
        <button
          type="button"
          aria-label="Close expanded chart"
          className="chart-expand-backdrop"
          onClick={() => setExpanded(false)}
        />
      ) : null}
      {expanded ? (
        <div
          className="live-chart-pane lg:min-h-[560px]"
          aria-hidden
        />
      ) : null}
      <div
        className={expanded ? "chart-expand-overlay" : undefined}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? true : undefined}
        aria-label={expanded ? `${active.name} expanded chart` : undefined}
      >
        {chartNode}
      </div>
    </section>
  );
}
