"use client";

import { useEffect, useState } from "react";
import { getNseMarketStatus, type MarketStatus } from "@/lib/market-hours";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function buildGreeting(name: string, now: Date) {
  const status = getNseMarketStatus(now);
  const istHour = Number(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    })
  );
  const weekday = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });
  const dateLine = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let tagline: string;
  switch (status) {
    case "weekend":
      tagline =
        "Markets are closed for the weekend — last session figures are shown below.";
      break;
    case "holiday":
      tagline =
        "Markets are closed for a cash holiday — last session figures are shown below.";
      break;
    case "closed":
      tagline =
        "Cash markets are closed — review the last session and prepare for the next open.";
      break;
    case "pre-open":
      tagline =
        "Pre-open is underway — quotes may be thin until continuous trading starts.";
      break;
    case "open":
      tagline =
        "Live Indian indices, institutional charts, and desk intelligence.";
      break;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }

  return {
    greet: greetingForHour(istHour),
    weekday,
    dateLine,
    first: name.split(" ")[0] || name,
    tagline,
    status: status as MarketStatus,
  };
}

export function Greeting({ name }: { name: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { greet, dateLine, weekday, first, tagline } = buildGreeting(name, now);

  return (
    <section className="panel-stable panel-luxe greeting-panel-luxe relative overflow-hidden rounded-2xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-8">
      <div
        className="greeting-orb pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 26%, transparent), transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 14%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mb-4 w-fit max-w-full rounded-xl border border-[color-mix(in_srgb,var(--gold)_20%,var(--border))] bg-[color-mix(in_srgb,var(--bg-elevated)_82%,transparent)] px-3 py-2 shadow-[0_10px_28px_color-mix(in_srgb,var(--ink)_4%,transparent)] backdrop-blur-sm sm:px-4 sm:py-2.5 md:absolute md:right-9 md:top-6 md:mb-0">
        <p className="section-kicker">Session date</p>
        <p
          className="mt-0.5 text-sm font-medium text-[var(--fg-muted)] sm:text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {weekday}
        </p>
        <p className="fin-num text-xs text-[var(--fg)] sm:text-sm">{dateLine}</p>
      </div>

      <div className="relative max-w-3xl pr-0 pt-0 md:pr-[240px] md:pt-1">
        <p className="section-kicker section-kicker-alive text-[var(--gold-deep)] dark:text-[var(--gold)]">
          Structured Products · Anand Rathi Wealth
        </p>
        <h1 className="mt-2 text-[1.7rem] leading-[1.08] sm:text-[2.05rem] sm:leading-[1.05] md:text-[2.85rem]">
          <span
            className="block text-[var(--fg-muted)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {greet},
          </span>
          <span
            className="gold-text gold-text-shimmer block"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {first}
          </span>
        </h1>
        <p className="mt-3 max-w-2xl border-l-2 border-[color-mix(in_srgb,var(--gold)_55%,transparent)] pl-3 text-sm leading-relaxed text-[var(--fg-muted)] sm:mt-3.5 sm:pl-4 md:text-[15px]">
          {tagline}
        </p>
      </div>
    </section>
  );
}
