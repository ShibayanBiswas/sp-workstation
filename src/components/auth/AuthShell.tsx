"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Props = {
  children: ReactNode;
  subtitle?: string;
  variant?: "signin" | "verify" | "recover";
};

export function AuthShell({
  children,
  subtitle,
  variant = "signin",
}: Props) {
  return (
    <div
      className={`auth-shell auth-shell-${variant} relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]`}
    >
      <div className="auth-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <BrandLogo priority className="h-11 w-auto md:h-12" />
        <div className="flex items-center gap-4">
          {subtitle ? (
            <span className="hidden text-[10px] font-bold tracking-[0.32em] text-[var(--fg-subtle)] md:inline">
              {subtitle}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-14 md:px-12">
        {children}
      </main>

      <footer className="relative z-10 border-t border-[color-mix(in_srgb,var(--gold)_12%,var(--border))] px-6 py-6 text-center md:px-12">
        <p className="text-[10px] font-medium tracking-[0.22em] text-[var(--fg-subtle)]">
          © {new Date().getFullYear()} ANAND RATHI WEALTH · STRUCTURED PRODUCTS ·
          INTERNAL USE ONLY
        </p>
      </footer>
    </div>
  );
}
