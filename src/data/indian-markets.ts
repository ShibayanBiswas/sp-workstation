export type IndianIndexGroup = "benchmark" | "sector" | "volatility";

/** Cash venue that owns live LTP / session open for this index. */
export type CashExchange = "NSE" | "BSE";

export type IndianIndex = {
  id: string;
  name: string;
  yahoo: string;
  group: IndianIndexGroup;
  /** Live print venue — Sensex is BSE; all other cash indices are NSE. */
  exchange: CashExchange;
};

/**
 * Display order: main benchmarks → sector indices → India VIX.
 * Tape, snapshot cards, and API responses follow this sequence.
 *
 * Live LTP / day open:
 * - Sensex → BSE GetSensexData (I_open, ltp, dttm)
 * - Everything else → NSE allIndices
 * Charts (candles) always use Yahoo OHLC; 1D tip patches to venue LTP.
 */
export const INDIAN_MARKET_INDICES: IndianIndex[] = [
  { id: "nifty", name: "Nifty 50", yahoo: "^NSEI", group: "benchmark", exchange: "NSE" },
  { id: "sensex", name: "Sensex", yahoo: "^BSESN", group: "benchmark", exchange: "BSE" },
  { id: "banknifty", name: "Bank Nifty", yahoo: "^NSEBANK", group: "benchmark", exchange: "NSE" },
  { id: "midcap", name: "Nifty Midcap 100", yahoo: "NIFTY_MIDCAP_100.NS", group: "benchmark", exchange: "NSE" },
  { id: "next50", name: "Nifty Next 50", yahoo: "^NSMIDCP", group: "benchmark", exchange: "NSE" },
  { id: "niftyit", name: "Nifty IT", yahoo: "^CNXIT", group: "sector", exchange: "NSE" },
  { id: "niftyauto", name: "Nifty Auto", yahoo: "^CNXAUTO", group: "sector", exchange: "NSE" },
  { id: "niftyfmcg", name: "Nifty FMCG", yahoo: "^CNXFMCG", group: "sector", exchange: "NSE" },
  { id: "niftymetal", name: "Nifty Metal", yahoo: "^CNXMETAL", group: "sector", exchange: "NSE" },
  { id: "niftypharma", name: "Nifty Pharma", yahoo: "^CNXPHARMA", group: "sector", exchange: "NSE" },
  { id: "niftyenergy", name: "Nifty Energy", yahoo: "^CNXENERGY", group: "sector", exchange: "NSE" },
  { id: "niftyfin", name: "Nifty Fin Service", yahoo: "NIFTY_FIN_SERVICE.NS", group: "sector", exchange: "NSE" },
  { id: "vix", name: "India VIX", yahoo: "^INDIAVIX", group: "volatility", exchange: "NSE" },
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

/** NSE/BSE cash session instruments. */
export function isCashSessionGroup(group: IndianIndexGroup): boolean {
  return group === "benchmark" || group === "sector" || group === "volatility";
}

/** Cash venue for session copy — Sensex is BSE; other cash indices are NSE. */
export function cashExchangeLabel(
  indexId: string
): CashExchange | null {
  const index = INDIAN_MARKET_INDICES.find((i) => i.id === indexId);
  if (!index || !isCashSessionGroup(index.group)) return null;
  return index.exchange;
}

/** e.g. "Last BSE session" / "Last NSE session" / "Last session". */
export function lastSessionPhrase(indexId?: string | null): string {
  if (!indexId) return "Last session";
  const ex = cashExchangeLabel(indexId);
  return ex ? `Last ${ex} session` : "Last session";
}
