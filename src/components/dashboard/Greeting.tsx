"use client";

import { useMemo } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const { greet, dateLine, first } = useMemo(() => {
    const now = new Date();
    return {
      greet: greetingForHour(now.getHours()),
      first: name.split(" ")[0] || name,
      dateLine: now.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [name]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 md:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 100% 0%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 55%)",
        }}
      />
      <div className="relative">
        <p className="text-xs tracking-[0.28em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
          STRUCTURED PRODUCTS · ANAND RATHI WEALTH
        </p>
        <h1
          className="mt-2 text-3xl md:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {greet}, <span className="gold-text">{first}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)] md:text-base">
          {dateLine}. Your Indian markets terminal is ready — indices, news,
          calendar, and desk tasks in one view.
        </p>
      </div>
    </div>
  );
}
