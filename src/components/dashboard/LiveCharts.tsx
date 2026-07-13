"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const CHARTS = [
  { symbol: "NSE:NIFTY", title: "Nifty 50", id: "nifty" },
  { symbol: "BSE:SENSEX", title: "BSE Sensex", id: "sensex" },
  { symbol: "NSE:NIFTYBANK", title: "Bank Nifty", id: "banknifty" },
] as const;

function TradingViewFrame({
  symbol,
  title,
  theme,
}: {
  symbol: string;
  title: string;
  theme: ThemeMode;
}) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_${symbol.replace(
    /[^a-zA-Z0-9]/g,
    ""
  )}&symbol=${encodeURIComponent(symbol)}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=${
    theme === "dark" ? "0d0d0d" : "f7f5f0"
  }&studies=[]&theme=${theme}&style=1&timezone=Asia%2FKolkata&withdateranges=1&hideideas=1&hidevolume=0&locale=en`;

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
            LIVE CHART
          </p>
          <h3
            className="text-lg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] tracking-wider text-[var(--gold-deep)] dark:text-[var(--gold)]">
          <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-emerald-500" />
          TradingView
        </span>
      </div>
      <iframe
        title={title}
        src={src}
        className="h-[360px] w-full border-0 md:h-[400px]"
        loading="lazy"
      />
    </div>
  );
}

export function LiveCharts() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [active, setActive] = useState<(typeof CHARTS)[number]["id"]>("nifty");

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

  const chart = CHARTS.find((c) => c.id === active) ?? CHARTS[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CHARTS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              active === c.id
                ? "gold-gradient border-transparent text-[#111]"
                : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>
      <TradingViewFrame
        symbol={chart.symbol}
        title={chart.title}
        theme={theme}
      />
    </div>
  );
}
