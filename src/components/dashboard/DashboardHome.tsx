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
      <div className="terminal-shell min-h-full pb-10">
        <div className="terminal-canvas space-y-5 p-5 md:space-y-6 md:p-8">
          <div className="animate-rise space-y-5">
            <TerminalHeader />
            <Greeting name={name} />
          </div>

          <div className="animate-rise-delay-1 space-y-4">
            <IndianMarketTape />
            <IndianMarketCards />
          </div>

          <div className="animate-rise-delay-2">
            <LiveCharts />
          </div>

          <div className="animate-rise-delay-3">
            <QuickModules />
          </div>

          <footer className="border-t border-[var(--border)] pt-6 text-center text-[10px] tracking-[0.2em] text-[var(--fg-subtle)]">
            ANAND RATHI WEALTH · STRUCTURED PRODUCTS WORKSTATION
          </footer>
        </div>
      </div>
    </MarketsProvider>
  );
}
