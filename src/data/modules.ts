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
  icon: "chart" | "layers" | "shield" | "graduation" | "database" | "percent";
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
  "https://option-data-fetcher.vercel.app";

const GIFT_CITY_AIF_BASE =
  process.env.NEXT_PUBLIC_GIFT_CITY_AIF_URL ??
  "https://gift-city-aif-backtester.vercel.app";

const GIFT_CITY_AIF_FORWARDTESTER_BASE =
  process.env.NEXT_PUBLIC_GIFT_CITY_AIF_FORWARDTESTER_URL ??
  "https://gift-city-aif-forwardtester.vercel.app";

const DYNAMIC_PROBABILITY_CALCULATOR_BASE =
  process.env.NEXT_PUBLIC_DYNAMIC_PROBABILITY_CALCULATOR_URL ??
  "https://dynamic-probability-calculator-9aso.vercel.app";

export const SP_DASHBOARD_BASE = SP_BASE;
export const OPTIONS_LAB_EMBED_BASE = OPTIONS_LAB_BASE;
export const OPTION_CHAIN_ARCHIVE_EMBED_BASE = OPTION_CHAIN_ARCHIVE_BASE;
export const GIFT_CITY_AIF_EMBED_BASE = GIFT_CITY_AIF_BASE;
export const GIFT_CITY_AIF_FORWARDTESTER_EMBED_BASE =
  GIFT_CITY_AIF_FORWARDTESTER_BASE;
export const DYNAMIC_PROBABILITY_CALCULATOR_EMBED_BASE =
  DYNAMIC_PROBABILITY_CALCULATOR_BASE;

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

/** Dynamic Probability Calculator — Primary/Rollover book probabilities. */
const DYNAMIC_PROBABILITY_LEAVES: SubModule[] = [
  {
    id: "dpc-home",
    label: "Home",
    description: "Dynamic Probability Calculator home",
    path: "/dashboard/module/dynamic-probability-calculator",
    spPath: "/",
  },
  {
    id: "dpc-analytics",
    label: "Analytics",
    description: "Portfolio analytics by lifecycle",
    path: "/dashboard/module/dynamic-probability-calculator/portfolio/analytics",
    spPath: "/portfolio/analytics",
  },
  {
    id: "dpc-desk",
    label: "Desk",
    description: "Desk modules hub",
    path: "/dashboard/module/dynamic-probability-calculator/desk",
    spPath: "/desk",
  },
  {
    id: "dpc-probability",
    label: "Probability",
    description: "Probability desk module",
    path: "/dashboard/module/dynamic-probability-calculator/probability",
    spPath: "/probability",
  },
  {
    id: "dpc-initial-probability",
    label: "Initial Probability",
    description: "Initial probability views",
    path: "/dashboard/module/dynamic-probability-calculator/initial-probability",
    spPath: "/initial-probability",
  },
  {
    id: "dpc-current-probability",
    label: "Current Probability",
    description: "Current probability views",
    path: "/dashboard/module/dynamic-probability-calculator/current-probability",
    spPath: "/current-probability",
  },
  {
    id: "dpc-intel",
    label: "Intel",
    description: "Intel · Logic Atlas",
    path: "/dashboard/module/dynamic-probability-calculator/intelligence",
    spPath: "/intelligence",
  },
  {
    id: "dpc-upload",
    label: "Upload",
    description: "Upload New Product Master workbook",
    path: "/dashboard/module/dynamic-probability-calculator/upload",
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

const GIFT_CITY_AIF_LEAVES: SubModule[] = [
  {
    id: "gift-home",
    label: "Home",
    description: "GIFT City Cat-III AIF backtester home",
    path: "/dashboard/module/gift-city-aif",
    spPath: "/",
  },
  {
    id: "gift-analytics",
    label: "Analytics",
    description: "Rolling path analytics since 2001",
    path: "/dashboard/module/gift-city-aif/analytics",
    spPath: "/analytics",
  },
  {
    id: "gift-product",
    label: "Product",
    description: "Structured units product sheet",
    path: "/dashboard/module/gift-city-aif/product",
    spPath: "/product",
  },
  {
    id: "gift-paths",
    label: "Paths",
    description: "Path calendar & frequency windows",
    path: "/dashboard/module/gift-city-aif/paths",
    spPath: "/paths",
  },
  {
    id: "gift-hedging",
    label: "Hedging Sheet",
    description: "Hedging sheet for structured units",
    path: "/dashboard/module/gift-city-aif/hedging",
    spPath: "/hedging",
  },
  {
    id: "gift-computation",
    label: "Computation",
    description: "Desk computation engine",
    path: "/dashboard/module/gift-city-aif/computation",
    spPath: "/computation",
  },
  {
    id: "gift-ledger",
    label: "Daily Ledger",
    description: "Daily ledger under computation",
    path: "/dashboard/module/gift-city-aif/computation/ledger",
    spPath: "/computation/ledger",
  },
  {
    id: "gift-intel",
    label: "Intel",
    description: "GIFT City AIF intelligence surface",
    path: "/dashboard/module/gift-city-aif/intel",
    spPath: "/intel",
  },
];

/** GIFT City Cat-III AIF forwardtester — same desk surfaces, forward from today. */
const GIFT_CITY_AIF_FORWARDTESTER_LEAVES: SubModule[] = [
  {
    id: "gift-ft-home",
    label: "Home",
    description: "GIFT City Cat-III AIF forwardtester home",
    path: "/dashboard/module/gift-city-aif-forwardtester",
    spPath: "/",
  },
  {
    id: "gift-ft-analytics",
    label: "Analytics",
    description: "Forward-test analytics lab",
    path: "/dashboard/module/gift-city-aif-forwardtester/analytics",
    spPath: "/analytics",
  },
  {
    id: "gift-ft-product",
    label: "Product",
    description: "Structured units product sheet",
    path: "/dashboard/module/gift-city-aif-forwardtester/product",
    spPath: "/product",
  },
  {
    id: "gift-ft-paths",
    label: "Paths",
    description: "Path calendar from today through simulation end",
    path: "/dashboard/module/gift-city-aif-forwardtester/paths",
    spPath: "/paths",
  },
  {
    id: "gift-ft-hedging",
    label: "Hedging Sheet",
    description: "Hedging sheet for structured units",
    path: "/dashboard/module/gift-city-aif-forwardtester/hedging",
    spPath: "/hedging",
  },
  {
    id: "gift-ft-computation",
    label: "Computation",
    description: "Forward-test computation engine",
    path: "/dashboard/module/gift-city-aif-forwardtester/computation",
    spPath: "/computation",
  },
  {
    id: "gift-ft-intel",
    label: "Intel",
    description: "GIFT City AIF forwardtester intelligence",
    path: "/dashboard/module/gift-city-aif-forwardtester/intel",
    spPath: "/intel",
  },
];

function leafFrom(list: SubModule[], id: string): NavItem {
  const sub = list.find((s) => s.id === id);
  if (!sub) {
    throw new Error(`Unknown submodule id "${id}" in module registry`);
  }
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

function dpcLeaf(id: string): NavItem {
  return leafFrom(DYNAMIC_PROBABILITY_LEAVES, id);
}

function giftCityLeaf(id: string): NavItem {
  return leafFrom(GIFT_CITY_AIF_LEAVES, id);
}

function giftCityForwardtesterLeaf(id: string): NavItem {
  return leafFrom(GIFT_CITY_AIF_FORWARDTESTER_LEAVES, id);
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
    id: "dynamic-probability-calculator",
    label: "Dynamic Probability Calculator",
    description:
      "Live Primary/Rollover book probabilities, observation ladder & desk analytics",
    icon: "percent",
    href: "/dashboard/module/dynamic-probability-calculator",
    routeSlug: "dynamic-probability-calculator",
    embedBase: DYNAMIC_PROBABILITY_CALCULATOR_BASE,
    frameTitle: "DYNAMIC PROBABILITY CALCULATOR",
    nav: [
      dpcLeaf("dpc-home"),
      {
        id: "dpc-portfolio",
        label: "Portfolio",
        description: "Portfolio by lifecycle & analytics",
        children: [dpcLeaf("dpc-analytics")],
      },
      {
        id: "dpc-desk-group",
        label: "Desk",
        description: "Probability desk modules",
        path: "/dashboard/module/dynamic-probability-calculator/desk",
        children: [
          dpcLeaf("dpc-probability"),
          dpcLeaf("dpc-initial-probability"),
          dpcLeaf("dpc-current-probability"),
        ],
      },
      dpcLeaf("dpc-intel"),
      dpcLeaf("dpc-upload"),
    ],
    submodules: DYNAMIC_PROBABILITY_LEAVES,
  },
  {
    id: "gift-city-aif",
    label: "Gift City AIF Backtester",
    description:
      "GIFT City Category III AIF structured units backtester — rolling paths since 2001",
    icon: "layers",
    href: "/dashboard/module/gift-city-aif",
    routeSlug: "gift-city-aif",
    embedBase: GIFT_CITY_AIF_BASE,
    frameTitle: "GIFT CITY AIF · BACKTESTER",
    // Same top-level order as Primary SP: Home → Analytics → Desk → Intel
    nav: [
      giftCityLeaf("gift-home"),
      giftCityLeaf("gift-analytics"),
      {
        id: "gift-desk-group",
        label: "Desk",
        description: "Product, paths, hedging & computation",
        path: "/dashboard/module/gift-city-aif/product",
        children: [
          giftCityLeaf("gift-product"),
          giftCityLeaf("gift-paths"),
          giftCityLeaf("gift-hedging"),
          giftCityLeaf("gift-computation"),
          giftCityLeaf("gift-ledger"),
        ],
      },
      giftCityLeaf("gift-intel"),
    ],
    submodules: GIFT_CITY_AIF_LEAVES,
  },
  {
    id: "gift-city-aif-forwardtester",
    label: "Gift City AIF Forwardtester",
    description:
      "GIFT City Category III AIF structured units forwardtester — paths from today through simulation end",
    icon: "shield",
    href: "/dashboard/module/gift-city-aif-forwardtester",
    routeSlug: "gift-city-aif-forwardtester",
    embedBase: GIFT_CITY_AIF_FORWARDTESTER_BASE,
    frameTitle: "GIFT CITY AIF · FORWARDTESTER",
    nav: [
      giftCityForwardtesterLeaf("gift-ft-home"),
      giftCityForwardtesterLeaf("gift-ft-analytics"),
      {
        id: "gift-ft-desk-group",
        label: "Desk",
        description: "Product, paths, hedging & computation",
        path: "/dashboard/module/gift-city-aif-forwardtester/product",
        children: [
          giftCityForwardtesterLeaf("gift-ft-product"),
          giftCityForwardtesterLeaf("gift-ft-paths"),
          giftCityForwardtesterLeaf("gift-ft-hedging"),
          giftCityForwardtesterLeaf("gift-ft-computation"),
        ],
      },
      giftCityForwardtesterLeaf("gift-ft-intel"),
    ],
    submodules: GIFT_CITY_AIF_FORWARDTESTER_LEAVES,
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
