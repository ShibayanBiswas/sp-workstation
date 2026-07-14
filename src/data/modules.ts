export type SubModule = {
  id: string;
  label: string;
  description: string;
  path: string;
  spPath: string;
};

/** Sidebar item — link leaf, or nested group that expands vertically. */
export type NavItem = {
  id: string;
  label: string;
  description?: string;
  /** Workstation route (omitted for expand-only parents like Portfolio). */
  path?: string;
  /** Nested children; expand only when the chevron is used. */
  children?: NavItem[];
};

export type ModuleGroup = {
  id: string;
  label: string;
  description: string;
  icon: "chart" | "layers" | "shield";
  /** Primary module home — clicking the module row goes here. */
  href: string;
  /** Hierarchical sidebar tree (collapsed by default). */
  nav: NavItem[];
  /** Flat leaf routes used by the iframe page resolver. */
  submodules: SubModule[];
};

const SP_BASE =
  process.env.NEXT_PUBLIC_SP_DASHBOARD_URL ??
  "https://sp-dashboard-eta.vercel.app";

export const SP_DASHBOARD_BASE = SP_BASE;

const PRIMARY_LEAVES: SubModule[] = [
  {
    id: "home",
    label: "Home",
    description: "Primary SP Dashboard home",
    path: "/dashboard/module/primary-sp",
    spPath: "/",
  },
  {
    id: "portfolio-analytics",
    label: "Analytics",
    description: "Analytics across the SP book",
    path: "/dashboard/module/primary-sp/portfolio/analytics",
    spPath: "/portfolio/analytics",
  },
  {
    id: "portfolio-details",
    label: "Product Details",
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
    id: "valuation",
    label: "Valuation",
    description: "Pricing & fair value views",
    path: "/dashboard/module/primary-sp/valuation",
    spPath: "/valuation",
  },
  {
    id: "payoff",
    label: "Payoff",
    description: "Scenario & payoff modelling",
    path: "/dashboard/module/primary-sp/payoff",
    spPath: "/payoff",
  },
  {
    id: "intelligence",
    label: "Intel",
    description: "Market & product intelligence",
    path: "/dashboard/module/primary-sp/intelligence",
    spPath: "/intelligence",
  },
  {
    id: "upload",
    label: "Upload",
    description: "Product master & data ingest",
    path: "/dashboard/module/primary-sp/upload",
    spPath: "/upload",
  },
];

function leaf(id: string): NavItem {
  const sub = PRIMARY_LEAVES.find((s) => s.id === id)!;
  return {
    id: sub.id,
    label: sub.label,
    description: sub.description,
    path: sub.path,
  };
}

/** Workstation navigation — Primary SP Dashboard mapped to live SP app routes. */
export const MODULES: ModuleGroup[] = [
  {
    id: "primary-sp",
    label: "Primary SP Dashboard",
    description: "Live structured products desk, portfolio & intelligence",
    icon: "chart",
    href: "/dashboard/module/primary-sp",
    nav: [
      leaf("home"),
      {
        id: "portfolio",
        label: "Portfolio",
        description: "Portfolio analytics & product details",
        children: [leaf("portfolio-analytics"), leaf("portfolio-details")],
      },
      {
        id: "desk-group",
        label: "Desk",
        description: "Desk, valuation & payoff",
        path: "/dashboard/module/primary-sp/desk",
        children: [leaf("valuation"), leaf("payoff")],
      },
      leaf("intelligence"),
      leaf("upload"),
    ],
    submodules: PRIMARY_LEAVES,
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

/** Collect every path under a nav node (for active-state highlighting). */
export function collectNavPaths(item: NavItem): string[] {
  const own = item.path ? [item.path] : [];
  const child = (item.children ?? []).flatMap(collectNavPaths);
  return [...own, ...child];
}
