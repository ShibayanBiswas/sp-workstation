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

  const benchmarks = indicesByGroup("benchmark");
  const sectors = indicesByGroup("sector");
  const volatility = indicesByGroup("volatility");
  const fx = indicesByGroup("fx");

  return (
    <section
      id="live-chart"
      className="panel-stable panel-luxe overflow-hidden rounded-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 md:px-5">
        <div>
          <p className="section-kicker">
            {instrumentLive
              ? "Live chart"
              : awaitingPrint
                ? "Awaiting open"
                : "Session chart"}
          </p>
          <h3 className="section-title">{active.name}</h3>
        </div>
        <div className="relative w-full min-w-[240px] sm:w-auto sm:min-w-[280px]">
          <label className="sr-only" htmlFor="index-select">
            Select index
          </label>
          <select
            id="index-select"
            value={selectedIndexId}
            onChange={(e) => setSelectedIndexId(e.target.value)}
            className="input-field w-full appearance-none py-2.5 pr-10 text-sm transition-all duration-300 focus:scale-[1.01]"
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
            <optgroup label="FX">
              {fx.map((i) => (
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-300 ${
                  timeframe === tf.id
                    ? "bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[var(--gold-deep)] dark:text-[var(--gold)] scale-[1.02]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:scale-[1.02]"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setZoomEnabled((z) => !z)}
            title={
              zoomEnabled
                ? "Disable pan and zoom"
                : "Enable pan, scroll, and zoom"
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
              zoomEnabled
                ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-[var(--gold-deep)] dark:text-[var(--gold)]"
                : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
            }`}
          >
            <Move size={14} />
            Zoom {zoomEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveSyncIndicator
            syncing={syncing}
            lastSyncedAt={asOf}
            lastMarketTime={liveQuote?.marketTime ?? lastMarketTime}
            marketStatus={marketStatus}
            awaitingTodayPrint={awaitingPrint}
            compact
          />
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${marketBadgeClass(marketStatus, awaitingPrint)}`}
          >
            {awaitingPrint
              ? "Awaiting open · IST"
              : `${marketStatusLabel(marketStatus)} · IST`}
          </span>
        </div>
        {zoomEnabled ? (
          <span className="text-[10px] text-[var(--fg-subtle)]">
            Full history loaded · wheel to zoom · drag to pan
          </span>
        ) : null}
      </div>

      {mounted ? (
        <CandlestickChart
          key={`${selectedIndexId}-${timeframe}`}
          indexId={selectedIndexId}
          timeframe={timeframe}
          theme={theme}
          name={active.name}
          zoomEnabled={zoomEnabled}
          marketStatus={marketStatus}
          fallbackPrice={liveQuote?.price}
          syncedQuote={
            liveQuote
              ? {
                  price: liveQuote.price,
                  change: liveQuote.change,
                  changePercent: liveQuote.changePercent,
                  dayOpen: liveQuote.dayOpen,
                  marketTime: liveQuote.marketTime,
                  sessionPrinted: liveQuote.sessionPrinted,
                }
              : null
          }
          syncedAsOf={asOf}
        />
      ) : (
        <div className="flex h-[540px] items-center justify-center text-sm text-[var(--fg-subtle)]">
          <span className={instrumentLive ? "animate-pulse-live" : ""}>
            Preparing chart…
          </span>
        </div>
      )}
    </section>
  );
}
