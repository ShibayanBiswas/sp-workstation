"use client";

import { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";
import {
  getNseMarketStatus,
  marketStatusLabel,
  type MarketStatus,
} from "@/lib/market-hours";

function statusColor(status: MarketStatus) {
  switch (status) {
    case "open":
      return "bg-emerald-500";
    case "pre-open":
      return "bg-amber-500";
    case "closed":
    case "weekend":
      return "bg-red-500";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function TerminalHeader() {
  const [now, setNow] = useState<Date | null>(null);
  const [status, setStatus] = useState<MarketStatus>("closed");

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      setStatus(getNseMarketStatus(current));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr =
    now?.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) ?? "--:--:--";

  const dateStr =
    now?.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) ?? "";

  return (
    <div className="terminal-header flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity
            size={14}
            className="text-[var(--gold-deep)] dark:text-[var(--gold)]"
          />
          <span className="text-[10px] font-semibold tracking-[0.28em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
            SP TERMINAL
          </span>
        </div>
        <span className="hidden h-4 w-px bg-[var(--border)] sm:block" />
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${statusColor(status)} ${status === "open" ? "animate-pulse-live" : ""}`}
          />
          <span className="text-xs font-medium text-[var(--fg-muted)]">
            {marketStatusLabel(status)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--fg-subtle)]">
        <span className="hidden md:inline">NSE · BSE · IST</span>
        <div className="flex items-center gap-2 tabular-nums">
          <Clock size={13} className="text-[var(--fg-subtle)]" />
          <span className="font-medium text-[var(--fg)]">{timeStr}</span>
          <span className="hidden sm:inline">{dateStr}</span>
        </div>
      </div>
    </div>
  );
}
