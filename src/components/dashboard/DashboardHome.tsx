"use client";

import { Greeting } from "@/components/dashboard/Greeting";
import { TerminalHeader } from "@/components/dashboard/TerminalHeader";
import {
  MarketsProvider,
  IndianMarketTape,
  IndianMarketCards,
} from "@/components/dashboard/MarketsProvider";
import { LiveCharts } from "@/components/dashboard/LiveCharts";
import { QuickModules } from "@/components/dashboard/QuickModules";

type Props = {
  name: string;
};

export function DashboardHome({ name }: Props) {
  return (
    <MarketsProvider>
      <div className="terminal-shell terminal-shell-alive min-h-full pb-10">
          <div className="terminal-canvas space-y-4 p-3 sm:space-y-5 sm:p-5 md:space-y-6 md:p-8">
          <div className="animate-rise space-y-5">
            <TerminalHeader />
            <Greeting name={name} />
          </div>

          <div className="animate-rise-delay-1 space-y-4">
            <IndianMarketTape />
            <IndianMarketCards />
          </div>

          <div className="animate-rise-delay-2 panel-enter-glow">
            <LiveCharts />
          </div>

          <div className="animate-rise-delay-3 panel-enter-glow">
            <QuickModules />
          </div>

          <footer className="animate-rise-delay-4 border-t border-[var(--border)] pt-6 text-center text-[10px] tracking-[0.2em] text-[var(--fg-subtle)]">
            ANAND RATHI WEALTH · STRUCTURED PRODUCTS WORKSTATION
          </footer>
        </div>
      </div>
    </MarketsProvider>
  );
}
