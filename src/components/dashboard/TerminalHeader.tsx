"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useMarkets } from "@/components/dashboard/MarketsProvider";
import { LiveSyncIndicator } from "@/components/dashboard/LiveSyncIndicator";
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
  const { syncing, asOf } = useMarkets();
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
    }) ?? "";

  return (
    <div className="terminal-header panel-stable panel-luxe flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2 md:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold tracking-[0.32em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
          SP TERMINAL
        </span>
        <span className="hidden h-4 w-px bg-[var(--border)] sm:block" />
        <span className="status-pill">
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusColor(status)} ${status === "open" ? "animate-pulse-live" : ""}`}
          />
          {marketStatusLabel(status)}
        </span>
        <span className="hidden text-[11px] text-[var(--fg-subtle)] lg:inline">
          NSE · BSE · IST
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LiveSyncIndicator syncing={syncing} lastSyncedAt={asOf} compact />
        <Clock size={14} />
        <span className="fin-num text-sm font-medium text-[var(--fg)]">
          {timeStr}
        </span>
        <span className="hidden text-xs text-[var(--fg-subtle)] sm:inline">
          {dateStr}
        </span>
      </div>
    </div>
  );
}
