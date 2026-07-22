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
import { refreshIntervalForStatus } from "@/lib/live-refresh";
import {
  getNseMarketStatus,
  hasTodaySessionPrint,
  isMarketLive,
  isMarketSessionActive,
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
  source?: "nse" | "yahoo";
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
    try {
      const res = await fetch("/api/markets", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const next = dedupeQuotes(data.quotes || []);
      const changed = new Set<string>();
      // Only flash ticks while the cash session is live.
      if (isMarketLive(status)) {
        for (const q of next) {
          if (q.price == null) continue;
          const prev = prevPrices.current.get(q.id);
          if (prev != null && prev !== q.price) changed.add(q.id);
          prevPrices.current.set(q.id, q.price);
        }
        if (changed.size > 0) {
          setFlashIds(changed);
          setTimeout(() => setFlashIds(new Set()), 700);
        }
      } else {
        for (const q of next) {
          if (q.price != null) prevPrices.current.set(q.id, q.price);
        }
      }
      setQuotes(sortByDisplayOrder(next));
      setAsOf(data.asOf || new Date().toISOString());
      if (data.marketStatus) setMarketStatus(data.marketStatus);
    } catch {
      /* ignore */
    } finally {
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
      const delay = refreshIntervalForStatus(status);
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

  /** Latest NSE/BSE cash-session print (excludes FX overnight stamps). */
  const lastMarketTime = useMemo(() => {
    let max = 0;
    let niftyTime: number | null = null;
    for (const q of quotes) {
      if (!isCashSessionGroup(q.group)) continue;
      if (q.marketTime == null) continue;
      if (q.id === "nifty") niftyTime = q.marketTime;
      if (q.marketTime > max) max = q.marketTime;
    }
    // Prefer Nifty when it is within 15 minutes of the latest cash print.
    if (niftyTime != null && max - niftyTime < 15 * 60) return niftyTime;
    return max > 0 ? max : null;
  }, [quotes]);

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
        className={`tape-chip tape-chip-7 tape-chip-animate inline-flex shrink-0 items-stretch gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 ${flash ? "price-flash" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-[var(--fg)]">
            {q.name}
          </p>
          <p className="tv-num text-sm font-semibold leading-none text-[var(--fg)]">
            {formatMarketPrice(q.price, q.id)}
          </p>
          <p
            className={`tv-num text-[11px] font-semibold leading-tight ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {up ? "▲" : "▼"} {formatMarketChangePercent(q.changePercent)}
          </p>
        </div>
        <Sparkline
          data={spark}
          up={up}
          width={76}
          height={52}
          showArea
          className="shrink-0 self-center"
        />
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
        className={`tape-viewport relative min-h-[104px] overflow-hidden py-1 ${!sessionActive ? "tape-viewport-paused" : ""}`}
      >
        {loading && quotes.length === 0 ? (
          <div className="flex h-[92px] items-center gap-2 px-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="tape-chip-7 h-[92px] flex-1 animate-shimmer rounded-lg bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <div className="tape-track flex min-h-[92px] items-center gap-2 px-3">
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
                const awaitingPrint = sessionActive && !printToday;
                const cardStamp = formatIstSessionStamp(q.marketTime, {
                  forceDate:
                    !sessionActive || awaitingPrint || q.group === "fx",
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
                    className={`market-card market-card-animate snapshot-card-5 shrink-0 rounded-xl border p-4 text-left ${
                      active
                        ? "market-card-active border-[color-mix(in_srgb,var(--gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))]"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    } ${flash ? "price-flash" : ""} ${awaitingPrint ? "opacity-90" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 min-h-[2rem] text-[10px] font-bold leading-tight tracking-[0.1em] text-[var(--fg-subtle)]">
                        {q.name.toUpperCase()}
                      </p>
                      <Sparkline
                        data={spark}
                        up={up}
                        width={80}
                        height={36}
                        showArea={false}
                        strokeWidth={1.5}
                        className="shrink-0 opacity-90"
                      />
                    </div>
                    <p className="tv-num mt-2 text-[1.65rem] font-semibold leading-none text-[var(--fg)]">
                      {formatMarketPrice(q.price, q.id)}
                    </p>
                    <p
                      className={`tv-num mt-2 text-xs font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {formatMarketChange(q.change, q.id)} (
                      {formatMarketChangePercent(q.changePercent)})
                      {awaitingPrint ? (
                        <span className="ml-1 text-[10px] font-medium text-[var(--fg-subtle)]">
                          last session
                        </span>
                      ) : null}
                    </p>
                    {cardStamp ? (
                      <p className="mt-2 text-[10px] text-[var(--fg-subtle)]">
                        {awaitingPrint
                          ? `Awaiting open · ${cardStamp} IST`
                          : `${cardStamp} IST`}
                      </p>
                    ) : awaitingPrint ? (
                      <p className="mt-2 text-[10px] text-[var(--fg-subtle)]">
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
