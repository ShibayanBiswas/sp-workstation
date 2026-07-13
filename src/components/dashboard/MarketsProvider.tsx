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
import { INDIAN_MARKET_INDICES, sortByDisplayOrder } from "@/data/indian-markets";
import { LIVE_REFRESH_MS } from "@/lib/live-refresh";
import { Sparkline } from "@/components/dashboard/Sparkline";

export type MarketQuote = {
  id: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: number[];
  group: string;
};

type MarketsContextValue = {
  quotes: MarketQuote[];
  asOf: string;
  loading: boolean;
  refresh: () => Promise<void>;
  selectedIndexId: string;
  setSelectedIndexId: (id: string) => void;
  flashIds: Set<string>;
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

function fmt(n: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatIstTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevPrices = useRef<Map<string, number>>(new Map());
  const inFlight = useRef(false);
  const [selectedIndexId, setSelectedIndexId] = useState(
    INDIAN_MARKET_INDICES[0].id
  );

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/markets", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const next = dedupeQuotes(data.quotes || []);
      const changed = new Set<string>();
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
      setQuotes(sortByDisplayOrder(next));
      setAsOf(data.asOf || "");
    } catch {
      /* ignore */
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
    });
    const id = setInterval(refresh, LIVE_REFRESH_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      quotes: sortByDisplayOrder(dedupeQuotes(quotes)),
      asOf,
      loading,
      refresh,
      selectedIndexId,
      setSelectedIndexId,
      flashIds,
    }),
    [quotes, asOf, loading, refresh, selectedIndexId, flashIds]
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

/** Row 1 — auto-scrolling live tape. */
export function IndianMarketTape() {
  const { quotes, loading, flashIds } = useMarkets();

  const chips = quotes.map((q) => {
    const up = (q.change ?? 0) >= 0;
    const spark = q.sparkline?.length ? q.sparkline : [0, 0];
    const flash = flashIds.has(q.id);
    return (
      <div
        key={`tape-${q.id}`}
        className={`tape-chip tape-chip-7 inline-flex shrink-0 items-stretch gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 ${flash ? "price-flash" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-[var(--fg)]">
            {q.name}
          </p>
          <p className="tv-num text-sm font-semibold leading-none text-[var(--fg)]">
            {fmt(q.price)}
          </p>
          <p
            className={`tv-num text-[11px] font-semibold leading-tight ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {up ? "▲" : "▼"} {up ? "+" : ""}
            {fmt(q.changePercent)}%
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
    <section className="panel-stable overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 md:px-5">
        <div>
          <p className="section-kicker">Live tape</p>
          <p className="section-title">Indian market indices</p>
        </div>
        <p className="text-[10px] text-[var(--fg-subtle)]">Auto-scroll · IST</p>
      </div>
      <div className="tape-viewport relative min-h-[104px] overflow-hidden py-1">
        {loading && quotes.length === 0 ? (
          <div className="flex h-[92px] items-center gap-2 px-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="tape-chip-7 h-[92px] flex-1 animate-pulse rounded-lg bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <div className="tape-track flex min-h-[92px] items-center gap-2 px-3">
            {chips}
            {chips}
          </div>
        )}
      </div>
    </section>
  );
}

/** Row 2 — snapshot cards, horizontal scroll. */
export function IndianMarketCards() {
  const { quotes, loading, asOf, selectedIndexId, setSelectedIndexId, flashIds } =
    useMarkets();
  const timeLabel = formatIstTime(asOf);

  return (
    <section className="panel-stable rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 md:px-5">
        <div>
          <p className="section-kicker">Snapshot</p>
          <p className="section-title">Index performance</p>
        </div>
        <p className="text-[10px] text-[var(--fg-subtle)]">
          {quotes.length} indices
        </p>
      </div>
      <div className="snapshot-viewport overflow-x-auto p-3 scrollbar-thin md:p-4">
        <div className="flex w-max min-w-full gap-2">
          {loading && quotes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="snapshot-card-5 h-[168px] animate-pulse rounded-xl bg-[var(--bg-muted)]"
                />
              ))
            : quotes.map((q) => {
                const up = (q.change ?? 0) >= 0;
                const active = q.id === selectedIndexId;
                const spark = q.sparkline?.length ? q.sparkline : [0, 0];
                const flash = flashIds.has(q.id);
                return (
                  <button
                    key={`card-${q.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedIndexId(q.id);
                      document
                        .getElementById("live-chart")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                    className={`market-card snapshot-card-5 shrink-0 rounded-xl border p-4 text-left ${
                      active
                        ? "market-card-active border-[color-mix(in_srgb,var(--gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))]"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    } ${flash ? "price-flash" : ""}`}
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
                    <p
                      className="tv-num mt-2 text-[1.65rem] font-semibold leading-none text-[var(--fg)]"
                    >
                      {fmt(q.price)}
                    </p>
                    <p
                      className={`tv-num mt-2 text-xs font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {q.change != null
                        ? `${up ? "+" : ""}${fmt(q.change)}`
                        : "—"}{" "}
                      ({up ? "+" : ""}
                      {fmt(q.changePercent)}%)
                    </p>
                    {timeLabel ? (
                      <p className="mt-2 text-[10px] text-[var(--fg-subtle)]">
                        {timeLabel} IST
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
