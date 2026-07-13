import { Greeting } from "@/components/dashboard/Greeting";
import { TerminalHeader } from "@/components/dashboard/TerminalHeader";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { MarketStrip } from "@/components/dashboard/MarketStrip";
import { LiveCharts } from "@/components/dashboard/LiveCharts";
import { QuickModules } from "@/components/dashboard/QuickModules";
import { NewsPanel } from "@/components/dashboard/NewsPanel";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { TodoPanel } from "@/components/dashboard/TodoPanel";
import { getSession } from "@/lib/auth";

export default async function DashboardHomePage() {
  const session = await getSession();
  const name = session?.name || "Team Member";

  return (
    <div className="terminal-shell min-h-full space-y-4 p-4 md:space-y-5 md:p-6">
      <TerminalHeader />
      <Greeting name={name} />
      <MarketTicker />
      <MarketStrip />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <LiveCharts />
          <QuickModules />
        </div>
        <div className="flex min-h-[520px] flex-col gap-4">
          <NewsPanel />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CalendarPanel />
        <div className="min-h-[400px]">
          <TodoPanel />
        </div>
      </div>

      <footer className="border-t border-[var(--border)] pb-2 pt-4 text-center text-[10px] tracking-wide text-[var(--fg-subtle)]">
        Market data via Yahoo Finance · Charts by TradingView · News via RSS ·
        Anand Rathi Wealth Structured Products · Internal use only
      </footer>
    </div>
  );
}
