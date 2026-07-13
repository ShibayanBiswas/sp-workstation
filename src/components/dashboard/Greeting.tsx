"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  getNseMarketStatus,
  marketStatusLabel,
  type MarketStatus,
} from "@/lib/market-hours";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function statusBadge(status: MarketStatus) {
  switch (status) {
    case "open":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "pre-open":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "closed":
    case "weekend":
      return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function Greeting({ name }: { name: string }) {
  const [status, setStatus] = useState<MarketStatus>("closed");

  useEffect(() => {
    const tick = () => setStatus(getNseMarketStatus());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const { greet, dateLine, first, hour } = useMemo(() => {
    const now = new Date();
    const istHour = Number(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        hour12: false,
      })
    );
    return {
      greet: greetingForHour(istHour),
      first: name.split(" ")[0] || name,
      hour: istHour,
      dateLine: now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [name]);

  const tagline =
    hour >= 9 && hour < 16
      ? "Markets are active — your desk terminal is live with indices, charts, news, and SP modules."
      : "Your overnight desk view — review markets, plan observations, and track rollover follow-ups.";

  return (
    <div className="greeting-hero relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 md:p-8">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 25%, transparent), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
              STRUCTURED PRODUCTS · ANAND RATHI WEALTH
            </p>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${statusBadge(status)}`}
            >
              {marketStatusLabel(status)}
            </span>
          </div>
          <h1
            className="text-3xl md:text-4xl lg:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {greet},{" "}
            <span className="gold-text">{first}</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)] md:text-base">
            {dateLine}. {tagline}
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-4 py-3 md:flex">
          <Sparkles
            size={18}
            className="text-[var(--gold-deep)] dark:text-[var(--gold)]"
          />
          <div>
            <p className="text-[10px] tracking-[0.14em] text-[var(--fg-subtle)]">
              DESK STATUS
            </p>
            <p className="text-sm font-medium">Terminal Ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}
