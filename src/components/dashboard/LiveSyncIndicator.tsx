"use client";

import { useEffect, useState } from "react";
import { LIVE_REFRESH_MS } from "@/lib/live-refresh";
import {
  getNseMarketStatus,
  isMarketLive,
  isMarketSessionActive,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  formatIstSessionStamp,
  formatIstSyncTime,
} from "@/lib/market-quote";

type Props = {
  syncing: boolean;
  lastSyncedAt: string;
  /** Prefer last exchange print when markets are closed. */
  lastMarketTime?: number | null;
  compact?: boolean;
  marketStatus?: MarketStatus;
  /**
   * Selected instrument still shows a prior IST-day print while the venue
   * session is open (feed lag / not yet opened on this symbol).
   */
  awaitingTodayPrint?: boolean;
};

function secondsUntilRefresh(lastSyncedAt: string, now: number): number {
  if (!lastSyncedAt) return Math.ceil(LIVE_REFRESH_MS / 1000);
  const elapsed = now - new Date(lastSyncedAt).getTime();
  return Math.max(0, Math.ceil((LIVE_REFRESH_MS - elapsed) / 1000));
}

export function LiveSyncIndicator({
  syncing,
  lastSyncedAt,
  lastMarketTime,
  compact = false,
  marketStatus: statusProp,
  awaitingTodayPrint = false,
}: Props) {
  const [now, setNow] = useState(0);
  const [clockStatus, setClockStatus] = useState<MarketStatus>(() =>
    getNseMarketStatus()
  );
  const status = statusProp ?? clockStatus;

  useEffect(() => {
    if (statusProp != null) return;
    const id = setInterval(() => setClockStatus(getNseMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, [statusProp]);

  useEffect(() => {
    if (!isMarketLive(status) || awaitingTodayPrint) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, awaitingTodayPrint]);

  const live = isMarketLive(status) && !awaitingTodayPrint;
  const sessionActive = isMarketSessionActive(status);
  const stamp =
    (!sessionActive || awaitingTodayPrint) && lastMarketTime
      ? formatIstSessionStamp(lastMarketTime, { forceDate: true })
      : formatIstSessionStamp(lastSyncedAt) || formatIstSyncTime(lastSyncedAt);

  const secondsUntil =
    now > 0
      ? secondsUntilRefresh(lastSyncedAt, now)
      : Math.ceil(LIVE_REFRESH_MS / 1000);

  let label: string;
  if (awaitingTodayPrint) {
    label = stamp
      ? `Awaiting open · last print ${stamp} IST`
      : "Awaiting today's print";
  } else if (sessionActive) {
    if (syncing) {
      label = live ? "Syncing markets…" : "Updating quotes…";
    } else if (stamp) {
      label = live ? `Live · ${stamp} IST` : `Pre-open · ${stamp} IST`;
    } else {
      label = live ? "Live · connecting…" : "Pre-open · connecting…";
    }
  } else if (status === "weekend") {
    label = stamp
      ? `Weekend · last session ${stamp} IST`
      : "Weekend · markets closed";
  } else {
    label = stamp
      ? `Closed · last session ${stamp} IST`
      : "Markets closed";
  }

  const title = awaitingTodayPrint
    ? "This index has no print for today's IST session yet — showing the last available session"
    : sessionActive
      ? "Prices refresh automatically during the market session"
      : "NSE/BSE cash markets are closed — showing the last session print";

  return (
    <div
      className={`live-sync-pill ${syncing && sessionActive && !awaitingTodayPrint ? "live-sync-pill-syncing" : ""} ${!sessionActive || awaitingTodayPrint ? "live-sync-pill-closed" : ""} ${compact ? "live-sync-pill-compact" : ""}`}
      title={title}
    >
      <span
        className={`live-sync-dot ${live ? (syncing ? "live-sync-dot-syncing" : "") : "live-sync-dot-closed"}`}
        aria-hidden
      />
      <span className="live-sync-text">
        {label}
        {live && !syncing && lastSyncedAt ? (
          <span key={secondsUntil} className="live-sync-countdown">
            {" "}
            · next in {secondsUntil}s
          </span>
        ) : null}
      </span>
    </div>
  );
}
