"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Props = {
  children: ReactNode;
  subtitle?: string;
};

export function AuthShell({ children, subtitle }: Props) {
  return (
    <div className="auth-shell relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.65] dark:opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -15%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 58%), radial-gradient(ellipse 45% 35% at 100% 100%, color-mix(in srgb, var(--gold) 10%, transparent), transparent 52%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
        <BrandLogo priority className="h-11 w-auto md:h-12" />
        <div className="flex items-center gap-4">
          {subtitle ? (
            <span className="hidden text-[10px] font-semibold tracking-[0.28em] text-[var(--fg-subtle)] md:inline">
              {subtitle}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 md:px-10">
        {children}
      </main>

      <footer className="relative z-10 px-6 py-5 text-center text-[10px] tracking-[0.2em] text-[var(--fg-subtle)] md:px-10">
        © {new Date().getFullYear()} Anand Rathi Wealth · Internal use only
      </footer>
    </div>
  );
}
