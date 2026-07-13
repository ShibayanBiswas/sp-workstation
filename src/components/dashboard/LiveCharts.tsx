"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { INDIAN_MARKET_INDICES } from "@/data/indian-markets";
import { useMarkets } from "@/components/dashboard/MarketsProvider";
import { CandlestickChart } from "@/components/dashboard/CandlestickChart";
import {
  CHART_TIMEFRAMES,
  type ChartTimeframeId,
} from "@/lib/chart-timeframes";
import {
  getNseMarketStatus,
  marketStatusLabel,
} from "@/lib/market-hours";

type ThemeMode = "light" | "dark";

const TV_FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

function marketBadgeClass(status: ReturnType<typeof getNseMarketStatus>) {
  switch (status) {
    case "open":
      return "bg-[#089981]/15 text-[#089981] dark:bg-[#26a69a]/15 dark:text-[#26a69a]";
    case "pre-open":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-[var(--bg-muted)] text-[var(--fg-subtle)]";
  }
}

function fmtPrice(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return null;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Row 3 — TradingView-style chart terminal. */
export function LiveCharts() {
  const { quotes, selectedIndexId, setSelectedIndexId } = useMarkets();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [timeframe, setTimeframe] = useState<ChartTimeframeId>("1D");
  const [mounted, setMounted] = useState(false);
  const [marketStatus, setMarketStatus] = useState(getNseMarketStatus());

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
    const tick = () => setMarketStatus(getNseMarketStatus());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const active =
    INDIAN_MARKET_INDICES.find((i) => i.id === selectedIndexId) ??
    INDIAN_MARKET_INDICES[0];

  const liveQuote = quotes.find((q) => q.id === selectedIndexId);
  const livePrice = fmtPrice(liveQuote?.price);
  const up = (liveQuote?.change ?? 0) >= 0;

  const benchmarks = INDIAN_MARKET_INDICES.filter((i) => i.group === "benchmark");
  const sectors = INDIAN_MARKET_INDICES.filter((i) => i.group === "sector");
  const volatility = INDIAN_MARKET_INDICES.filter((i) => i.group === "volatility");

  return (
    <section
      id="live-chart"
      className="overflow-hidden rounded-xl border border-[#2a2e39]/20 bg-[#131722] shadow-lg dark:border-[#2a2e39]"
      style={{ fontFamily: TV_FONT }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2e39] px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative min-w-[180px]">
            <label className="sr-only" htmlFor="index-select">
              Select index
            </label>
            <select
              id="index-select"
              value={selectedIndexId}
              onChange={(e) => setSelectedIndexId(e.target.value)}
              className="w-full appearance-none rounded-md border border-[#2a2e39] bg-[#1e222d] py-2 pl-3 pr-9 text-[13px] font-semibold text-[#d1d4dc] outline-none focus:border-[#2962ff]"
              style={{ fontFamily: TV_FONT }}
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
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#787b86]"
            />
          </div>
          {livePrice ? (
            <div className="hidden items-baseline gap-2 sm:flex">
              <span
                className="tv-num text-[15px] font-semibold"
                style={{ color: up ? "#26a69a" : "#ef5350" }}
              >
                {livePrice}
              </span>
              {liveQuote?.changePercent != null ? (
                <span
                  className="tv-num text-[12px] font-medium"
                  style={{ color: up ? "#26a69a" : "#ef5350" }}
                >
                  {up ? "+" : ""}
                  {liveQuote.changePercent.toFixed(2)}%
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${marketBadgeClass(marketStatus)}`}
            style={{ fontFamily: TV_FONT }}
          >
            {marketStatusLabel(marketStatus)}
          </span>
          <span className="text-[10px] text-[#787b86]">IST · NSE</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[#2a2e39] px-2 py-1 scrollbar-thin md:px-3">
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf.id}
            type="button"
            onClick={() => setTimeframe(tf.id)}
            className={`shrink-0 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              timeframe === tf.id
                ? "bg-[#2962ff] text-white"
                : "text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
            }`}
            style={{ fontFamily: TV_FONT }}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto hidden pr-2 text-[10px] text-[#787b86] md:inline">
          Candles · Volume
        </span>
      </div>

      {mounted ? (
        <CandlestickChart
          key={`${selectedIndexId}-${timeframe}-${theme}`}
          indexId={selectedIndexId}
          timeframe={timeframe}
          theme={theme}
          name={active.name}
          fallbackPrice={liveQuote?.price}
          fallbackChange={liveQuote?.change}
          fallbackChangePercent={liveQuote?.changePercent}
        />
      ) : (
        <div
          className="flex h-[560px] items-center justify-center text-sm text-[#787b86]"
          style={{ fontFamily: TV_FONT }}
        >
          Preparing chart…
        </div>
      )}
    </section>
  );
}
