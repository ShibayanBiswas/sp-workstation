"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { INDIAN_MARKET_INDICES } from "@/data/indian-markets";
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
  const [selectedIndexId, setSelectedIndexId] = useState(
    INDIAN_MARKET_INDICES[0].id
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/markets", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuotes(dedupeQuotes(data.quotes || []));
      setAsOf(data.asOf || "");
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
    });
    const id = setInterval(refresh, 60_000);
    return () => {
      window.cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      quotes: dedupeQuotes(quotes),
      asOf,
      loading,
      refresh,
      selectedIndexId,
      setSelectedIndexId,
    }),
    [quotes, asOf, loading, refresh, selectedIndexId]
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

/** Row 1 — auto-scrolling tape with sparklines (TradingView-style). */
export function IndianMarketTape() {
  const { quotes, loading } = useMarkets();

  const chips = quotes.map((q) => {
    const up = (q.change ?? 0) >= 0;
    const spark = q.sparkline?.length ? q.sparkline : [0, 0];
    const priceColor = up ? "#089981" : "#f23645";
    return (
      <div
        key={`tape-${q.id}`}
        className="tape-chip tape-chip-7 inline-flex shrink-0 items-center gap-3 rounded-md border border-[#2a2e39]/30 bg-[#131722] px-3 py-2.5 dark:border-[#2a2e39]"
        style={{ fontFamily: "var(--font-tv)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#d1d4dc]">
            {q.name}
          </p>
          <p
            className="tv-num text-[15px] font-semibold leading-tight"
            style={{ color: q.price != null ? priceColor : "#787b86" }}
          >
            {fmt(q.price)}
          </p>
          <p
            className="tv-num text-[11px] font-semibold"
            style={{ color: priceColor }}
          >
            {q.changePercent != null
              ? `${up ? "+" : ""}${fmt(q.changePercent)}%`
              : "—"}
          </p>
        </div>
        <Sparkline
          data={spark}
          up={up}
          width={88}
          height={44}
          showArea
          className="shrink-0"
        />
      </div>
    );
  });

  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2e39]/25 bg-[#131722] shadow-sm dark:border-[#2a2e39]">
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-4 py-2.5 md:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#787b86]">
            LIVE TAPE
          </p>
          <p
            className="text-[15px] font-semibold text-[#d1d4dc]"
            style={{ fontFamily: "var(--font-tv)" }}
          >
            Indian indices
          </p>
        </div>
        <p className="text-[10px] text-[#787b86]">IST · Auto-scroll</p>
      </div>
      <div className="tape-viewport relative h-[88px] overflow-hidden">
        {loading && quotes.length === 0 ? (
          <div className="flex h-full items-center gap-2 px-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="tape-chip-7 h-16 flex-1 animate-pulse rounded-lg bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <div className="tape-track flex h-full items-center gap-2 px-3">
            {chips}
            {chips}
          </div>
        )}
      </div>
    </section>
  );
}

/** Row 2 — snapshot cards (TradingView-style). */
export function IndianMarketCards() {
  const { quotes, loading, asOf, selectedIndexId, setSelectedIndexId } =
    useMarkets();
  const timeLabel = formatIstTime(asOf);

  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2e39]/25 bg-[#131722] shadow-sm dark:border-[#2a2e39]">
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-4 py-2.5 md:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#787b86]">
            SNAPSHOT
          </p>
          <p
            className="text-[15px] font-semibold text-[#d1d4dc]"
            style={{ fontFamily: "var(--font-tv)" }}
          >
            Index levels
          </p>
        </div>
        <p className="text-[10px] text-[#787b86]">{quotes.length} indices</p>
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
                const priceColor = up ? "#089981" : "#f23645";
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
                    className={`snapshot-card-5 shrink-0 rounded-lg border p-4 text-left transition-colors ${
                      active
                        ? "border-[#2962ff] bg-[#1e222d]"
                        : "border-[#2a2e39] bg-[#131722] hover:border-[#434651]"
                    }`}
                    style={{ fontFamily: "var(--font-tv)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold tracking-[0.12em] text-[#787b86]">
                        {q.name.toUpperCase()}
                      </p>
                      <Sparkline
                        data={spark}
                        up={up}
                        width={72}
                        height={32}
                        showArea={false}
                        strokeWidth={1.5}
                        className="shrink-0 opacity-90"
                      />
                    </div>
                    <p
                      className="tv-num mt-2 text-[1.75rem] font-semibold leading-none"
                      style={{ color: q.price != null ? priceColor : "#787b86" }}
                    >
                      {fmt(q.price)}
                    </p>
                    <p
                      className="tv-num mt-2 text-[12px] font-medium"
                      style={{ color: priceColor }}
                    >
                      {q.change != null
                        ? `${up ? "+" : ""}${fmt(q.change)}`
                        : "—"}{" "}
                      ({q.changePercent != null
                        ? `${up ? "+" : ""}${fmt(q.changePercent)}%`
                        : "—"})
                    </p>
                    {timeLabel ? (
                      <p className="mt-2 text-[10px] text-[#787b86]">
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
