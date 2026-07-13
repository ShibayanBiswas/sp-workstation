import { Greeting } from "@/components/dashboard/Greeting";
import { MarketStrip } from "@/components/dashboard/MarketStrip";
import { LiveCharts } from "@/components/dashboard/LiveCharts";
import { NewsPanel } from "@/components/dashboard/NewsPanel";
import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { TodoPanel } from "@/components/dashboard/TodoPanel";
import { getSession } from "@/lib/auth";

export default async function DashboardHomePage() {
  const session = await getSession();
  const name = session?.name || "Team Member";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Greeting name={name} />
      <MarketStrip />
      <LiveCharts />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="min-h-[420px]">
          <NewsPanel />
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <CalendarPanel />
          <div className="min-h-[360px]">
            <TodoPanel />
          </div>
        </div>
      </div>
      <footer className="pb-4 text-center text-[11px] text-[var(--fg-subtle)]">
        Market data via free public feeds · Charts by TradingView · News via RSS
        · Anand Rathi Wealth Structured Products
      </footer>
    </div>
  );
}
