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
      <div className="terminal-shell home-static home-hide-scrollbars min-h-full">
        <div className="terminal-canvas space-y-3 px-3 pt-2 pb-0 sm:space-y-3.5 sm:px-4 sm:pt-3 md:space-y-4 md:px-5 md:pt-4">
          <div className="space-y-3">
            <TerminalHeader />
            <Greeting name={name} />
          </div>

          <div className="home-scroll-section space-y-3">
            <IndianMarketTape />
            <IndianMarketCards />
          </div>

          <div className="home-scroll-section-chart">
            <LiveCharts />
          </div>

          <footer className="border-t border-[var(--border)] px-1 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[9px] tracking-[0.14em] text-[var(--fg-subtle)] sm:text-[10px] sm:tracking-[0.18em]">
            ANAND RATHI WEALTH · STRUCTURED PRODUCTS WORKSTATION
          </footer>
        </div>
      </div>
    </MarketsProvider>
  );
}
