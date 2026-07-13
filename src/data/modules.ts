export type SubModule = {
  id: string;
  label: string;
  description: string;
  path: string;
  spPath: string;
};

export type ModuleGroup = {
  id: string;
  label: string;
  description: string;
  icon: "chart" | "layers" | "shield";
  href: string;
  submodules: SubModule[];
};

const SP_BASE =
  process.env.NEXT_PUBLIC_SP_DASHBOARD_URL ??
  "https://sp-dashboard-eta.vercel.app";

export const SP_DASHBOARD_BASE = SP_BASE;

/** Workstation navigation — Primary SP Dashboard mapped to live SP app routes. */
export const MODULES: ModuleGroup[] = [
  {
    id: "primary-sp",
    label: "Primary SP Dashboard",
    description: "Live structured products desk, portfolio & intelligence",
    icon: "chart",
    href: "/dashboard/module/primary-sp",
    submodules: [
      {
        id: "overview",
        label: "Overview",
        description: "Live notional, lifecycle & portfolio pulse",
        path: "/dashboard/module/primary-sp",
        spPath: "/",
      },
      {
        id: "portfolio-analytics",
        label: "Portfolio Analytics",
        description: "Analytics across the SP book",
        path: "/dashboard/module/primary-sp/portfolio/analytics",
        spPath: "/portfolio/analytics",
      },
      {
        id: "portfolio-details",
        label: "Portfolio Details",
        description: "Position-level product detail",
        path: "/dashboard/module/primary-sp/portfolio/details",
        spPath: "/portfolio/details",
      },
      {
        id: "desk",
        label: "Desk",
        description: "Desk inventory & product master",
        path: "/dashboard/module/primary-sp/desk",
        spPath: "/desk",
      },
      {
        id: "intelligence",
        label: "Intelligence",
        description: "Market & product intelligence",
        path: "/dashboard/module/primary-sp/intelligence",
        spPath: "/intelligence",
      },
      {
        id: "valuation",
        label: "Valuation",
        description: "Pricing & fair value views",
        path: "/dashboard/module/primary-sp/valuation",
        spPath: "/valuation",
      },
      {
        id: "payoff",
        label: "Payoff Analysis",
        description: "Scenario & payoff modelling",
        path: "/dashboard/module/primary-sp/payoff",
        spPath: "/payoff",
      },
      {
        id: "upload",
        label: "Upload",
        description: "Product master & data ingest",
        path: "/dashboard/module/primary-sp/upload",
        spPath: "/upload",
      },
    ],
  },
];

export function resolveSpUrl(spPath: string): string {
  const base = SP_DASHBOARD_BASE.replace(/\/$/, "");
  if (spPath === "/") return `${base}/`;
  return `${base}${spPath.startsWith("/") ? spPath : `/${spPath}`}`;
}

export function findSubmoduleBySegments(
  segments: string[] | undefined
): SubModule {
  const group = MODULES[0];
  if (!segments || segments.length === 0) {
    return group.submodules[0];
  }
  const joined = `/${segments.join("/")}`;
  const match = group.submodules.find((s) => {
    const suffix = s.path.replace("/dashboard/module/primary-sp", "") || "";
    return suffix === joined;
  });
  return match ?? group.submodules[0];
}
