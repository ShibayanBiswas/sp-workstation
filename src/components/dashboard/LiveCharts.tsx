"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

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
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] tracking-wider text-[var(--gold-deep)] dark:text-[var(--gold)]">
          TradingView
        </span>
      </div>
      <iframe
        title={title}
        src={src}
        className="h-[340px] w-full border-0"
        loading="lazy"
      />
    </div>
  );
}

export function LiveCharts() {
  const [theme, setTheme] = useState<ThemeMode>("light");

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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TradingViewFrame
        symbol="NSE:NIFTY"
        title="Nifty 50"
        theme={theme}
      />
      <TradingViewFrame
        symbol="BSE:SENSEX"
        title="BSE Sensex"
        theme={theme}
      />
    </div>
  );
}
