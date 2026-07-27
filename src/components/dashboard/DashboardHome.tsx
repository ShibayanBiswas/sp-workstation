"use client";

import { Greeting } from "@/components/dashboard/Greeting";
import { TerminalHeader } from "@/components/dashboard/TerminalHeader";
import {
  MarketsProvider,
  IndianMarketTape,
  IndianMarketCards,
} from "@/components/dashboard/MarketsProvider";
import { LiveCharts } from "@/components/dashboard/LiveCharts";

type Props = {
  name: string;
};

export function DashboardHome({ name }: Props) {
  return (
    <MarketsProvider>
      <div className="terminal-shell terminal-shell-alive app-alive home-hide-scrollbars min-h-full">
        <div className="terminal-canvas space-y-4 px-3 pt-3 pb-0 sm:space-y-5 sm:px-5 sm:pt-5 md:space-y-6 md:px-8 md:pt-8">
          <div className="animate-rise space-y-5">
            <TerminalHeader />
            <Greeting name={name} />
          </div>

          <div className="home-scroll-section animate-rise-delay-1 space-y-4">
            <IndianMarketTape />
            <IndianMarketCards />
          </div>

          <div className="home-scroll-section-chart animate-rise-delay-2 panel-enter-glow">
            <LiveCharts />
          </div>

          <footer className="home-footer-luxe footer-alive animate-rise-delay-3 border-t border-[color-mix(in_srgb,var(--gold)_14%,var(--border))] px-2 pt-3 pb-[max(0.35rem,env(safe-area-inset-bottom))] text-center text-[9px] tracking-[0.12em] text-[var(--fg-subtle)] sm:text-[10px] sm:tracking-[0.22em]">
            ANAND RATHI WEALTH · STRUCTURED PRODUCTS WORKSTATION
          </footer>
        </div>
      </div>
    </MarketsProvider>
  );
}
