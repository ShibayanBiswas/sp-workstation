"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Brain,
  Calculator,
  LayoutGrid,
  LineChart,
  Table2,
  Upload,
} from "lucide-react";
import { MODULES } from "@/data/modules";

const ICONS: Record<string, ReactNode> = {
  overview: <LayoutGrid size={18} />,
  "portfolio-analytics": <BarChart3 size={18} />,
  "portfolio-details": <Table2 size={18} />,
  desk: <LineChart size={18} />,
  intelligence: <Brain size={18} />,
  valuation: <Calculator size={18} />,
  payoff: <LineChart size={18} />,
  upload: <Upload size={18} />,
};

export function QuickModules() {
  const mod = MODULES[0];

  return (
    <section className="panel-stable rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">Desk modules</p>
          <h3 className="section-title">Primary SP Dashboard</h3>
        </div>
        <p className="text-[11px] text-[var(--fg-subtle)]">
          One-click access to structured products workflows
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {mod.submodules.map((sub) => (
          <Link
            key={sub.id}
            href={sub.path}
            className="module-tile group flex flex-col gap-3 rounded-xl p-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--gold)_30%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] text-[var(--gold-deep)] dark:text-[var(--gold)]">
              {ICONS[sub.id] ?? <LayoutGrid size={18} />}
            </span>
            <span className="text-sm font-medium leading-tight text-[var(--fg)]">
              {sub.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
