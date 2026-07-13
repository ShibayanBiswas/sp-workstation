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
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-4">
        <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
          QUICK ACCESS
        </p>
        <h3
          className="text-lg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Primary SP Dashboard
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mod.submodules.map((sub) => (
          <Link
            key={sub.id}
            href={sub.path}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 transition hover:border-[color-mix(in_srgb,var(--gold)_50%,var(--border))] hover:bg-[color-mix(in_srgb,var(--gold)_8%,var(--bg-muted))]"
          >
            <span className="text-[var(--gold-deep)] transition group-hover:text-[var(--gold)] dark:text-[var(--gold)]">
              {ICONS[sub.id] ?? <LayoutGrid size={18} />}
            </span>
            <span className="text-xs font-medium leading-tight text-[var(--fg)]">
              {sub.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
