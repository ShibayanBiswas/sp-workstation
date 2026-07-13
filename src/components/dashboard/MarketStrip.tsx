"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
};

function formatNum(n: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function MarketStrip() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/markets");
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          setQuotes(data.quotes || []);
          setAsOf(data.asOf || "");
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const stamp = useMemo(() => {
    if (!asOf) return "";
    return new Date(asOf).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [asOf]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {quotes.map((q) => {
        const up = (q.change ?? 0) >= 0;
        return (
          <div
            key={q.symbol}
            className="glass-panel rounded-2xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
                  {q.name.toUpperCase()}
                </p>
                <p
                  className="mt-1 text-2xl font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatNum(q.price)}
                </p>
              </div>
              <div
                className={`rounded-full p-2 ${
                  up
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              </div>
            </div>
            <p
              className={`mt-2 text-sm tabular-nums ${
                up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {up ? "+" : ""}
              {formatNum(q.change)} ({up ? "+" : ""}
              {formatNum(q.changePercent)}%)
            </p>
            {stamp ? (
              <p className="mt-1 text-[10px] text-[var(--fg-subtle)]">
                As of {stamp} · free market feed
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
