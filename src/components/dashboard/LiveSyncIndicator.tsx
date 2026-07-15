"use client";

import { useEffect, useState } from "react";
import { LIVE_REFRESH_MS } from "@/lib/live-refresh";
import { formatIstSyncTime } from "@/lib/market-quote";

type Props = {
  syncing: boolean;
  lastSyncedAt: string;
  compact?: boolean;
};

function secondsUntilRefresh(lastSyncedAt: string, now: number): number {
  if (!lastSyncedAt) return Math.ceil(LIVE_REFRESH_MS / 1000);
  const elapsed = now - new Date(lastSyncedAt).getTime();
  return Math.max(0, Math.ceil((LIVE_REFRESH_MS - elapsed) / 1000));
}

export function LiveSyncIndicator({
  syncing,
  lastSyncedAt,
  compact = false,
}: Props) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const syncedLabel = formatIstSyncTime(lastSyncedAt);
  const secondsUntil =
    now > 0
      ? secondsUntilRefresh(lastSyncedAt, now)
      : Math.ceil(LIVE_REFRESH_MS / 1000);

  return (
    <div
      className={`live-sync-pill ${syncing ? "live-sync-pill-syncing" : ""} ${compact ? "live-sync-pill-compact" : ""}`}
      title="Prices and returns refresh automatically every minute"
    >
      <span
        className={`live-sync-dot ${syncing ? "live-sync-dot-syncing" : ""}`}
        aria-hidden
      />
      <span className="live-sync-text">
        {syncing
          ? "Syncing markets…"
          : syncedLabel
            ? `Live · ${syncedLabel} IST`
            : "Live · connecting…"}
        {!syncing && lastSyncedAt ? (
          <span key={secondsUntil} className="live-sync-countdown">
            {" "}
            · next in {secondsUntil}s
          </span>
        ) : null}
      </span>
    </div>
  );
}
