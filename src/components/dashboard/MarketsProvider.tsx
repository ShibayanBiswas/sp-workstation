"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  INDIAN_MARKET_INDICES,
  isCashSessionGroup,
  sortByDisplayOrder,
  type IndianIndexGroup,
} from "@/data/indian-markets";
import { refreshIntervalForTape } from "@/lib/live-refresh";
import { CLIENT_API_TIMEOUT_MS } from "@/lib/fetch-timeout";
import {
  getFxMarketStatus,
  getNseMarketStatus,
  hasTodaySessionPrint,
  isFxInstrumentLive,
  isMarketLive,
  isMarketSessionActive,
  lastCashSessionCloseUnix,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  formatMarketChange,
  formatMarketChangePercent,
  formatMarketPrice,
  formatIstSessionStamp,
} from "@/lib/market-quote";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { LiveSyncIndicator } from "@/components/dashboard/LiveSyncIndicator";

export type MarketQuote = {
  id: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayOpen?: number | null;
  previousClose?: number | null;
  sparkline: number[];
  group: IndianIndexGroup;
  marketTime?: number;
  /** True when marketTime is on today's IST calendar day. */
  sessionPrinted?: boolean;
  source?: "nse" | "bse" | "yahoo";
};

type MarketsContextValue = {
  quotes: MarketQuote[];
  asOf: string;
  /** Latest exchange print across quotes (unix sec). */
  lastMarketTime: number | null;
  marketStatus: MarketStatus;
  loading: boolean;
  syncing: boolean;
  refresh: () => Promise<void>;
  selectedIndexId: string;
  setSelectedIndexId: (id: string) => void;
  flashIds: Set<string>;
  quoteFor: (id: string) => MarketQuote | undefined;
};

const MarketsContext = createContext<MarketsContextValue | null>(null);

function dedupeQuotes(quotes: MarketQuote[]): MarketQuote[] {
  const seen = new Set<string>();
  return quotes.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(
    getNseMarketStatus()
  );
  const prevPrices = useRef<Map<string, number>>(new Map());
  const inFlight = useRef(false);
  const [selectedIndexId, setSelectedIndexId] = useState(
    INDIAN_MARKET_INDICES[0].id
  );

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const status = getNseMarketStatus();
    setMarketStatus(status);
    setSyncing(true);
    const ac = new AbortController();
    const kill = window.setTimeout(() => ac.abort(), CLIENT_API_TIMEOUT_MS);
    try {
      const res = await fetch("/api/markets", {
        cache: "no-store",
        credentials: "include",
        signal: ac.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      const next = dedupeQuotes(data.quotes || []);
      const changed = new Set<string>();
      const cashLive = isMarketLive(status);
      const fxOpen = getFxMarketStatus() === "open";
      // Flash cash ticks in the NSE session; FX can flash overnight too.
      for (const q of next) {
        if (q.price == null) continue;
        const prev = prevPrices.current.get(q.id);
        const flashOk =
          q.group === "fx" ? fxOpen : cashLive;
        if (flashOk && prev != null && prev !== q.price) changed.add(q.id);
        prevPrices.current.set(q.id, q.price);
      }
      if (changed.size > 0) {
        setFlashIds(changed);
        setTimeout(() => setFlashIds(new Set()), 700);
      }
      setQuotes(sortByDisplayOrder(next));
      setAsOf(data.asOf || new Date().toISOString());
      if (data.marketStatus) setMarketStatus(data.marketStatus);
    } catch {
      /* abort / network — keep last good quotes */
    } finally {
      window.clearTimeout(kill);
      inFlight.current = false;
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      const status = getNseMarketStatus();
      setMarketStatus(status);
      const delay = refreshIntervalForTape();
      timeoutId = window.setTimeout(() => {
        void refresh().finally(() => {
          if (!cancelled) scheduleNext();
        });
      }, delay);
    };

    const frame = window.requestAnimationFrame(() => {
      void refresh().finally(() => {
        if (!cancelled) scheduleNext();
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeoutId);
    };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setMarketStatus(getNseMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  const quoteFor = useCallback(
    (id: string) => quotes.find((q) => q.id === id),
    [quotes]
  );

  /** Latest cash-session print for closed-tape chrome (excludes FX). */
  const lastMarketTime = useMemo(() => {
    // When cash is not in continuous trading, always show the canonical
    // 15:30 IST close — never a vendor quirk (e.g. BSE 4:00 pm) or FX stamp.
    if (!isMarketLive(marketStatus)) {
      return lastCashSessionCloseUnix();
    }
    let max = 0;
    let niftyTime: number | null = null;
    for (const q of quotes) {
      if (!isCashSessionGroup(q.group)) continue;
      if (q.marketTime == null) continue;
      if (q.id === "nifty") niftyTime = q.marketTime;
      if (q.marketTime > max) max = q.marketTime;
    }
    if (niftyTime != null && max - niftyTime < 15 * 60) return niftyTime;
    return max > 0 ? max : null;
  }, [quotes, marketStatus]);

  const value = useMemo(
    () => ({
      quotes: sortByDisplayOrder(dedupeQuotes(quotes)),
      asOf,
      lastMarketTime,
      marketStatus,
      loading,
      syncing,
      refresh,
      selectedIndexId,
      setSelectedIndexId,
      flashIds,
      quoteFor,
    }),
    [
      quotes,
      asOf,
      lastMarketTime,
      marketStatus,
      loading,
      syncing,
      refresh,
      selectedIndexId,
      flashIds,
      quoteFor,
    ]
  );

  return (
    <MarketsContext.Provider value={value}>{children}</MarketsContext.Provider>
  );
}

export function useMarkets() {
  const ctx = useContext(MarketsContext);
  if (!ctx) throw new Error("useMarkets must be used within MarketsProvider");
  return ctx;
}

/** Row 1 — auto-scrolling market tape. */
export function IndianMarketTape() {
  const {
    quotes,
    loading,
    flashIds,
    syncing,
    asOf,
    lastMarketTime,
    marketStatus,
  } = useMarkets();
  const sessionActive = isMarketSessionActive(marketStatus);

  const chips = quotes.map((q, index) => {
    const up = (q.change ?? 0) >= 0;
    const spark = q.sparkline?.length ? q.sparkline : [0, 0];
    const flash = flashIds.has(q.id);
    return (
      <div
        key={`tape-${q.id}`}
        style={{ animationDelay: `${index * 60}ms` }}
        className={`tape-chip tape-chip-7 tape-chip-animate flex shrink-0 flex-col justify-between gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-2 sm:px-3 sm:py-2.5 ${flash ? "price-flash" : ""}`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-[10px] font-semibold leading-tight text-[var(--fg)] sm:text-[11px]">
            {q.name}
          </p>
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <p className="tv-num truncate text-[13px] font-semibold leading-none text-[var(--fg)] sm:text-sm">
              {formatMarketPrice(q.price, q.id)}
            </p>
            <p
              className={`tv-num shrink-0 text-[10px] font-semibold leading-none sm:text-[11px] ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {up ? "▲" : "▼"} {formatMarketChangePercent(q.changePercent)}
            </p>
          </div>
        </div>
        <div className="tape-spark mt-0.5 w-full min-w-0">
          <Sparkline
            data={spark}
            up={up}
            width={120}
            height={28}
            showArea
            fluid
            className="h-7 w-full"
          />
        </div>
      </div>
    );
  });

  return (
    <section className="panel-stable panel-luxe overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5 md:px-5">
        <div>
          <p className="section-kicker">
            {sessionActive ? "Live tape" : "Market tape"}
          </p>
          <p className="section-title">Indian market indices</p>
        </div>
        <LiveSyncIndicator
          syncing={syncing}
          lastSyncedAt={asOf}
          lastMarketTime={lastMarketTime}
          marketStatus={marketStatus}
          compact
        />
      </div>
      <div
        className={`tape-viewport relative min-h-[108px] overflow-hidden py-1 ${!sessionActive ? "tape-viewport-paused" : ""}`}
      >
        {loading && quotes.length === 0 ? (
          <div className="flex h-[96px] items-center gap-2 px-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="tape-chip-7 h-[96px] flex-1 animate-shimmer rounded-lg bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <div className="tape-track flex min-h-[96px] items-center gap-2 px-3">
            {chips}
            {sessionActive ? chips : null}
          </div>
        )}
      </div>
    </section>
  );
}

/** Row 2 — snapshot cards, horizontal scroll. */
export function IndianMarketCards() {
  const {
    quotes,
    loading,
    selectedIndexId,
    setSelectedIndexId,
    flashIds,
    syncing,
    asOf,
    lastMarketTime,
    marketStatus,
  } = useMarkets();
  const sessionActive = isMarketSessionActive(marketStatus);

  return (
    <section className="panel-stable panel-luxe rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5 md:px-5">
        <div>
          <p className="section-kicker">Snapshot</p>
          <p className="section-title">Index performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-[var(--fg-subtle)]">
            {quotes.length} indices
          </p>
          <LiveSyncIndicator
            syncing={syncing}
            lastSyncedAt={asOf}
            lastMarketTime={lastMarketTime}
            marketStatus={marketStatus}
            compact
          />
        </div>
      </div>
      <div className="snapshot-viewport overflow-x-auto p-3 scrollbar-thin md:p-4">
        <div className="flex w-max min-w-full gap-2">
          {loading && quotes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="snapshot-card-5 h-[168px] animate-shimmer rounded-xl bg-[var(--bg-muted)]"
                />
              ))
            : quotes.map((q, index) => {
                const up = (q.change ?? 0) >= 0;
                const active = q.id === selectedIndexId;
                const spark = q.sparkline?.length ? q.sparkline : [0, 0];
                const flash = flashIds.has(q.id);
                const printToday =
                  q.sessionPrinted ?? hasTodaySessionPrint(q.marketTime);
                const awaitingPrint =
                  q.group !== "fx" && sessionActive && !printToday;
                const fxLive =
                  q.group === "fx" && isFxInstrumentLive(q.marketTime);
                const cardStamp = formatIstSessionStamp(q.marketTime, {
                  forceDate:
                    q.group === "fx"
                      ? !fxLive
                      : !sessionActive || awaitingPrint,
                });
                return (
                  <button
                    key={`card-${q.id}`}
                    type="button"
                    style={{ animationDelay: `${index * 70}ms` }}
                    onClick={() => {
                      setSelectedIndexId(q.id);
                      document
                        .getElementById("live-chart")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                    className={`market-card market-card-animate snapshot-card-5 flex shrink-0 flex-col rounded-xl border p-3 text-left sm:p-3.5 md:p-4 ${
                      active
                        ? "market-card-active border-[color-mix(in_srgb,var(--gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))]"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    } ${flash ? "price-flash" : ""} ${awaitingPrint ? "opacity-90" : ""}`}
                  >
                    <p className="truncate text-[10px] font-bold leading-tight tracking-[0.08em] text-[var(--fg-subtle)]">
                      {q.name.toUpperCase()}
                    </p>
                    <p className="tv-num mt-1.5 truncate text-[1.35rem] font-semibold leading-none text-[var(--fg)] sm:mt-2 sm:text-[1.5rem] md:text-[1.65rem]">
                      {formatMarketPrice(q.price, q.id)}
                    </p>
                    <p
                      className={`tv-num mt-1.5 truncate text-[11px] font-medium sm:mt-2 sm:text-xs ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {formatMarketChange(q.change, q.id)} (
                      {formatMarketChangePercent(q.changePercent)})
                      {awaitingPrint ? (
                        <span className="ml-1 text-[10px] font-medium text-[var(--fg-subtle)]">
                          last session
                        </span>
                      ) : null}
                    </p>
                    <div className="market-card-spark mt-auto w-full min-w-0 pt-2.5 sm:pt-3">
                      <Sparkline
                        data={spark}
                        up={up}
                        width={160}
                        height={32}
                        showArea={false}
                        strokeWidth={1.5}
                        fluid
                        className="h-8 w-full opacity-90"
                      />
                    </div>
                    {cardStamp ? (
                      <p className="mt-2 truncate text-[10px] leading-tight text-[var(--fg-subtle)]">
                        {q.group === "fx"
                          ? fxLive
                            ? `FX live · ${cardStamp} IST`
                            : `FX · ${cardStamp} IST`
                          : awaitingPrint
                            ? `Awaiting open · ${cardStamp} IST`
                            : `${cardStamp} IST`}
                      </p>
                    ) : awaitingPrint ? (
                      <p className="mt-2 truncate text-[10px] leading-tight text-[var(--fg-subtle)]">
                        Awaiting today&apos;s print
                      </p>
                    ) : null}
                  </button>
                );
              })}
        </div>
      </div>
    </section>
  );
}
