export type IndianIndexGroup = "benchmark" | "sector" | "volatility" | "fx";

export type IndianIndex = {
  id: string;
  name: string;
  yahoo: string;
  group: IndianIndexGroup;
};

/**
 * Display order: main benchmarks → sector indices → India VIX → USD/INR.
 * Tape, snapshot cards, and API responses follow this sequence.
 */
export const INDIAN_MARKET_INDICES: IndianIndex[] = [
  { id: "nifty", name: "Nifty 50", yahoo: "^NSEI", group: "benchmark" },
  { id: "sensex", name: "Sensex", yahoo: "^BSESN", group: "benchmark" },
  { id: "banknifty", name: "Bank Nifty", yahoo: "^NSEBANK", group: "benchmark" },
  { id: "midcap", name: "Nifty Midcap 100", yahoo: "NIFTY_MIDCAP_100.NS", group: "benchmark" },
  { id: "next50", name: "Nifty Next 50", yahoo: "^NSMIDCP", group: "benchmark" },
  { id: "niftyit", name: "Nifty IT", yahoo: "^CNXIT", group: "sector" },
  { id: "niftyauto", name: "Nifty Auto", yahoo: "^CNXAUTO", group: "sector" },
  { id: "niftyfmcg", name: "Nifty FMCG", yahoo: "^CNXFMCG", group: "sector" },
  { id: "niftymetal", name: "Nifty Metal", yahoo: "^CNXMETAL", group: "sector" },
  { id: "niftypharma", name: "Nifty Pharma", yahoo: "^CNXPHARMA", group: "sector" },
  { id: "niftyenergy", name: "Nifty Energy", yahoo: "^CNXENERGY", group: "sector" },
  { id: "niftyfin", name: "Nifty Fin Service", yahoo: "NIFTY_FIN_SERVICE.NS", group: "sector" },
  { id: "vix", name: "India VIX", yahoo: "^INDIAVIX", group: "volatility" },
  { id: "usdinr", name: "USD/INR", yahoo: "INR=X", group: "fx" },
];

const DISPLAY_RANK = new Map(
  INDIAN_MARKET_INDICES.map((index, order) => [index.id, order])
);

export function getIndexById(id: string): IndianIndex {
  return (
    INDIAN_MARKET_INDICES.find((i) => i.id === id) ?? INDIAN_MARKET_INDICES[0]
  );
}

/** Sort quotes or any index-keyed list into canonical display order. */
export function sortByDisplayOrder<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (DISPLAY_RANK.get(a.id) ?? 999) - (DISPLAY_RANK.get(b.id) ?? 999)
  );
}

export function indicesByGroup(group: IndianIndexGroup): IndianIndex[] {
  return INDIAN_MARKET_INDICES.filter((i) => i.group === group);
}

/** NSE/BSE cash session instruments — exclude 24x5 FX from “last session” stamps. */
export function isCashSessionGroup(group: IndianIndexGroup): boolean {
  return group === "benchmark" || group === "sector" || group === "volatility";
}
