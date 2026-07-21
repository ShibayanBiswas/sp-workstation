export type SubModule = {
  id: string;
  label: string;
  description: string;
  path: string;
  /** Path on the embedded app (relative to that module's embed base). */
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
  icon: "chart" | "layers" | "shield" | "graduation" | "database";
  /** Primary module home — clicking the module row goes here. */
  href: string;
  /** Route segment under /dashboard/module/… */
  routeSlug: string;
  /** External app base URL for iframe embeds. */
  embedBase: string;
  /** Header label shown above the iframe. */
  frameTitle: string;
  /** Hierarchical sidebar tree (collapsed by default). */
  nav: NavItem[];
  /** Flat leaf routes used by the iframe page resolver. */
  submodules: SubModule[];
};

const SP_BASE =
  process.env.NEXT_PUBLIC_SP_DASHBOARD_URL ??
  "https://sp-dashboard-eta.vercel.app";

const OPTIONS_LAB_BASE =
  process.env.NEXT_PUBLIC_OPTIONS_LAB_URL ??
  "https://option-strategies.vercel.app";

const OPTION_CHAIN_ARCHIVE_BASE =
  process.env.NEXT_PUBLIC_OPTION_CHAIN_ARCHIVE_URL ??
  "https://reminder-citations-bathroom-picks.trycloudflare.com";

export const SP_DASHBOARD_BASE = SP_BASE;
export const OPTIONS_LAB_EMBED_BASE = OPTIONS_LAB_BASE;
export const OPTION_CHAIN_ARCHIVE_EMBED_BASE = OPTION_CHAIN_ARCHIVE_BASE;

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

const OPTIONS_LAB_LEAVES: SubModule[] = [
  {
    id: "options-lab-home",
    label: "Home",
    description: "Options Lab home",
    path: "/dashboard/module/options-lab",
    spPath: "/",
  },
  {
    id: "options-lab-intro",
    label: "Introduction & Greeks",
    description: "Options intro and Greeks primer",
    path: "/dashboard/module/options-lab/intro",
    spPath: "/intro",
  },
  {
    id: "options-lab-strategies",
    label: "Strategies",
    description: "Option strategy catalogue & payoff lab",
    path: "/dashboard/module/options-lab/strategies",
    spPath: "/strategies",
  },
];

/** Mirrors Option Chain Archive nav — Browse / NSE / BSE / Schema. */
const OPTION_CHAIN_LEAVES: SubModule[] = [
  {
    id: "oca-overview",
    label: "Overview",
    description: "Option Chain Archive home & coverage",
    path: "/dashboard/module/option-chain-archive",
    spPath: "/",
  },
  {
    id: "oca-browse",
    label: "Browse",
    description: "File tree explorer for NSE & BSE chains",
    path: "/dashboard/module/option-chain-archive/browse",
    spPath: "/browse",
  },
  {
    id: "oca-nse",
    label: "NSE",
    description: "NSE option chain archive tree",
    path: "/dashboard/module/option-chain-archive/browse/NSE",
    spPath: "/browse/NSE",
  },
  {
    id: "oca-bse",
    label: "BSE",
    description: "BSE option chain archive tree",
    path: "/dashboard/module/option-chain-archive/browse/BSE",
    spPath: "/browse/BSE",
  },
  {
    id: "oca-schema",
    label: "Schema map",
    description: "Hierarchy, sectors & ingest pipeline map",
    path: "/dashboard/module/option-chain-archive/schema",
    spPath: "/schema",
  },
];

function leafFrom(list: SubModule[], id: string): NavItem {
  const sub = list.find((s) => s.id === id)!;
  return {
    id: sub.id,
    label: sub.label,
    description: sub.description,
    path: sub.path,
  };
}

function primaryLeaf(id: string): NavItem {
  return leafFrom(PRIMARY_LEAVES, id);
}

function optionsLabLeaf(id: string): NavItem {
  return leafFrom(OPTIONS_LAB_LEAVES, id);
}

function optionChainLeaf(id: string): NavItem {
  return leafFrom(OPTION_CHAIN_LEAVES, id);
}

/** Workstation navigation — embedded desk modules with live app routes. */
export const MODULES: ModuleGroup[] = [
  {
    id: "primary-sp",
    label: "Primary SP Dashboard",
    description: "Live structured products desk, portfolio & intelligence",
    icon: "chart",
    href: "/dashboard/module/primary-sp",
    routeSlug: "primary-sp",
    embedBase: SP_BASE,
    frameTitle: "PRIMARY SP DASHBOARD",
    nav: [
      primaryLeaf("home"),
      {
        id: "portfolio",
        label: "Portfolio",
        description: "Portfolio analytics & product details",
        children: [
          primaryLeaf("portfolio-analytics"),
          primaryLeaf("portfolio-details"),
        ],
      },
      {
        id: "desk-group",
        label: "Desk",
        description: "Desk, valuation & payoff",
        path: "/dashboard/module/primary-sp/desk",
        children: [primaryLeaf("valuation"), primaryLeaf("payoff")],
      },
      primaryLeaf("intelligence"),
      primaryLeaf("upload"),
    ],
    submodules: PRIMARY_LEAVES,
  },
  {
    id: "lnd",
    label: "Learning & Development",
    description: "Training labs and option strategy learning tools",
    icon: "graduation",
    href: "/dashboard/module/options-lab",
    routeSlug: "options-lab",
    embedBase: OPTIONS_LAB_BASE,
    frameTitle: "OPTIONS LAB",
    nav: [
      {
        id: "options-lab",
        label: "Options Lab",
        description: "Interactive option strategies & Greeks",
        path: "/dashboard/module/options-lab",
        children: [
          optionsLabLeaf("options-lab-home"),
          optionsLabLeaf("options-lab-intro"),
          optionsLabLeaf("options-lab-strategies"),
        ],
      },
    ],
    submodules: OPTIONS_LAB_LEAVES,
  },
  {
    id: "database-hub",
    label: "Database Hub",
    description:
      "Historical NSE & BSE option chain archive for download and backtesting",
    icon: "database",
    href: "/dashboard/module/option-chain-archive",
    routeSlug: "option-chain-archive",
    embedBase: OPTION_CHAIN_ARCHIVE_BASE,
    frameTitle: "OPTION CHAIN ARCHIVE",
    nav: [
      {
        id: "option-chain-archive",
        label: "Option Chain Archive",
        description:
          "Daily Indian option chains — NSE & BSE bhavcopy, segregated CE/PE",
        path: "/dashboard/module/option-chain-archive",
        children: [
          optionChainLeaf("oca-overview"),
          {
            id: "oca-browse-group",
            label: "Browse",
            description: "Explorer for NSE & BSE archive trees",
            path: "/dashboard/module/option-chain-archive/browse",
            children: [
              optionChainLeaf("oca-nse"),
              optionChainLeaf("oca-bse"),
            ],
          },
          optionChainLeaf("oca-schema"),
        ],
      },
    ],
    submodules: OPTION_CHAIN_LEAVES,
  },
];

export function getModuleByRouteSlug(slug: string): ModuleGroup | undefined {
  return MODULES.find((m) => m.routeSlug === slug);
}

export function resolveEmbedUrl(group: ModuleGroup, spPath: string): string {
  const base = group.embedBase.replace(/\/$/, "");
  if (spPath === "/") return `${base}/`;
  return `${base}${spPath.startsWith("/") ? spPath : `/${spPath}`}`;
}

/** @deprecated Prefer resolveEmbedUrl with a ModuleGroup. */
export function resolveSpUrl(spPath: string): string {
  const primary = MODULES.find((m) => m.id === "primary-sp") ?? MODULES[0];
  return resolveEmbedUrl(primary, spPath);
}

export function findSubmoduleBySegments(
  moduleSlug: string,
  segments: string[] | undefined
): SubModule {
  const group =
    getModuleByRouteSlug(moduleSlug) ??
    MODULES.find((m) => m.id === "primary-sp") ??
    MODULES[0];
  if (!segments || segments.length === 0) {
    return group.submodules[0];
  }
  const joined = `/${segments.join("/")}`;
  const prefix = `/dashboard/module/${group.routeSlug}`;
  const match = group.submodules.find((s) => {
    const suffix = s.path.replace(prefix, "") || "";
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
