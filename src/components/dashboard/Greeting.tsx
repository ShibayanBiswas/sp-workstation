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
    <section className="panel-stable relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="relative mb-3 w-fit max-w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1.5 sm:px-3.5 sm:py-2 md:absolute md:right-5 md:top-4 md:mb-0">
        <p className="section-kicker">Session date</p>
        <p
          className="mt-0.5 text-sm font-medium text-[var(--fg-muted)] sm:text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {weekday}
        </p>
        <p className="fin-num text-xs text-[var(--fg)] sm:text-sm">{dateLine}</p>
      </div>

      <div className="relative max-w-3xl pr-0 md:pr-[220px]">
        <p className="section-kicker text-[var(--fg-subtle)]">
          Structured Products · Anand Rathi Wealth
        </p>
        <h1 className="mt-1.5 text-[1.6rem] leading-[1.08] sm:text-[1.95rem] sm:leading-[1.05] md:text-[2.55rem]">
          <span
            className="block text-[var(--fg-muted)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {greet},
          </span>
          <span
            className="block text-[var(--fg)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {first}
          </span>
        </h1>
        <p className="mt-2.5 max-w-2xl border-l-2 border-[var(--border)] pl-3 text-sm leading-relaxed text-[var(--fg-muted)] md:text-[15px]">
          {tagline}
        </p>
      </div>
    </section>
  );
}
