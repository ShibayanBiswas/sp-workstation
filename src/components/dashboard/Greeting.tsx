"use client";

import { useMemo } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const { greet, dateLine, weekday, first, tagline } = useMemo(() => {
    const now = new Date();
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
    return {
      greet: greetingForHour(istHour),
      weekday,
      dateLine,
      first: name.split(" ")[0] || name,
      tagline:
        istHour >= 9 && istHour < 16
          ? "Live Indian indices, institutional charts, and desk intelligence."
          : "Overnight view — review markets and prepare the session ahead.",
    };
  }, [name]);

  return (
    <section className="panel-stable relative overflow-hidden rounded-2xl px-6 py-6 md:px-9 md:py-7">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 22%, transparent), transparent 68%)",
        }}
      />

      <div className="absolute right-6 top-5 shrink-0 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] px-4 py-2.5 md:right-9 md:top-6">
        <p className="section-kicker">Session date</p>
        <p
          className="mt-0.5 text-base font-medium text-[var(--fg-muted)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {weekday}
        </p>
        <p className="fin-num text-sm text-[var(--fg)]">{dateLine}</p>
      </div>

      <div className="relative max-w-3xl pr-0 pt-1 md:pr-[240px]">
        <p className="section-kicker text-[var(--gold-deep)] dark:text-[var(--gold)]">
          Structured Products · Anand Rathi Wealth
        </p>
        <h1 className="mt-2 text-[2rem] leading-[1.08] md:text-[2.65rem]">
          <span
            className="block text-[var(--fg-muted)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {greet},
          </span>
          <span
            className="gold-text block"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {first}
          </span>
        </h1>
        <p className="mt-3 max-w-2xl border-l-2 border-[color-mix(in_srgb,var(--gold)_45%,transparent)] pl-4 text-sm leading-relaxed text-[var(--fg-muted)] md:text-[15px]">
          {tagline}
        </p>
      </div>
    </section>
  );
}
