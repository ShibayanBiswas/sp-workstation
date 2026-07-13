export type IndianIndex = {
  id: string;
  name: string;
  yahoo: string;
  group: "benchmark" | "sector" | "volatility";
};

/** Indian market indices. */
export const INDIAN_MARKET_INDICES: IndianIndex[] = [
  {
    id: "nifty",
    name: "Nifty 50",
    yahoo: "^NSEI",
    group: "benchmark",
  },
  {
    id: "sensex",
    name: "Sensex",
    yahoo: "^BSESN",
    group: "benchmark",
  },
  {
    id: "banknifty",
    name: "Bank Nifty",
    yahoo: "^NSEBANK",
    group: "benchmark",
  },
  {
    id: "midcap",
    name: "Nifty Midcap 100",
    yahoo: "^CNXMID",
    group: "benchmark",
  },
  {
    id: "next50",
    name: "Nifty Next 50",
    yahoo: "^NSMIDCP",
    group: "benchmark",
  },
  {
    id: "vix",
    name: "India VIX",
    yahoo: "^INDIAVIX",
    group: "volatility",
  },
  {
    id: "niftyit",
    name: "Nifty IT",
    yahoo: "^CNXIT",
    group: "sector",
  },
  {
    id: "niftyauto",
    name: "Nifty Auto",
    yahoo: "^CNXAUTO",
    group: "sector",
  },
  {
    id: "niftyfmcg",
    name: "Nifty FMCG",
    yahoo: "^CNXFMCG",
    group: "sector",
  },
  {
    id: "niftymetal",
    name: "Nifty Metal",
    yahoo: "^CNXMETAL",
    group: "sector",
  },
  {
    id: "niftypharma",
    name: "Nifty Pharma",
    yahoo: "^CNXPHARMA",
    group: "sector",
  },
  {
    id: "niftyenergy",
    name: "Nifty Energy",
    yahoo: "^CNXENERGY",
    group: "sector",
  },
  {
    id: "niftyfin",
    name: "Nifty Fin Service",
    yahoo: "^CNXFIN",
    group: "sector",
  },
  {
    id: "usdinr",
    name: "USD/INR",
    yahoo: "INR=X",
    group: "benchmark",
  },
];

export function getIndexById(id: string): IndianIndex {
  return (
    INDIAN_MARKET_INDICES.find((i) => i.id === id) ?? INDIAN_MARKET_INDICES[0]
  );
}
