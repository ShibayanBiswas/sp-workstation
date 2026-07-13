"use client";

import { useEffect, useState } from "react";

type Quote = {
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
};

function fmt(n: number | null, d = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/markets");
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setQuotes(data.quotes || []);
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

  if (quotes.length === 0) return null;

  const items = quotes.map((q) => {
    const up = (q.change ?? 0) >= 0;
    return (
      <span key={q.name} className="ticker-item inline-flex items-center gap-2 px-6">
        <span className="font-semibold text-[var(--fg)]">{q.name}</span>
        <span className="tabular-nums text-[var(--fg-muted)]">{fmt(q.price)}</span>
        <span
          className={`tabular-nums text-xs font-medium ${up ? "text-emerald-500" : "text-red-500"}`}
        >
          {up ? "▲" : "▼"} {fmt(q.changePercent)}%
        </span>
      </span>
    );
  });

  return (
    <div className="ticker-wrap overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="ticker-track flex whitespace-nowrap py-2 text-sm">
        {items}
        {items}
      </div>
    </div>
  );
}
