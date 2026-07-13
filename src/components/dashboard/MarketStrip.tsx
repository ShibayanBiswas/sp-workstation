"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/dashboard/Sparkline";

type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: number[];
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {quotes.map((q) => {
        const up = (q.change ?? 0) >= 0;
        return (
          <div
            key={q.symbol}
            className="market-card group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition hover:border-[color-mix(in_srgb,var(--gold)_35%,var(--border))]"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(ellipse at top right, color-mix(in srgb, var(--gold) 10%, transparent), transparent 70%)",
              }}
            />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-[var(--fg-subtle)]">
                  {q.name.toUpperCase()}
                </p>
                <p
                  className="mt-1 text-xl font-semibold tabular-nums md:text-2xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatNum(q.price)}
                </p>
              </div>
              <div
                className={`shrink-0 rounded-full p-1.5 ${
                  up
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </div>
            </div>
            <div className="relative mt-2 flex items-end justify-between gap-2">
              <p
                className={`text-xs tabular-nums font-medium ${
                  up
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {up ? "+" : ""}
                {formatNum(q.change)} ({up ? "+" : ""}
                {formatNum(q.changePercent)}%)
              </p>
              <Sparkline data={q.sparkline} positive={up} width={72} height={28} />
            </div>
            {stamp ? (
              <p className="relative mt-2 text-[9px] text-[var(--fg-subtle)]">
                {stamp} IST
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
