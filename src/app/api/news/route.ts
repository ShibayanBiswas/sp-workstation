import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary?: string;
};

async function fetchRss(url: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 900 },
      headers: { "User-Agent": "SP-Workstation/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) && items.length < 8) {
      const block = match[1];
      const title =
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ||
        block.match(/<title>(.*?)<\/title>/i)?.[1] ||
        "";
      const link =
        block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim() ||
        block.match(/<guid[^>]*>(.*?)<\/guid>/i)?.[1]?.trim() ||
        "";
      const pub =
        block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] ||
        new Date().toUTCString();
      const desc =
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ||
        block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
        "";
      const summary = desc.replace(/<[^>]+>/g, "").slice(0, 160).trim();
      if (title && link) {
        items.push({
          title: title.trim(),
          link,
          source,
          publishedAt: pub,
          summary,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

const FALLBACK_NEWS: NewsItem[] = [
  {
    title: "Nifty holds near record zone as FIIs turn selective on financials",
    link: "https://economictimes.indiatimes.com/markets",
    source: "Markets Desk",
    publishedAt: new Date().toUTCString(),
    summary:
      "Benchmark indices consolidate as traders watch RBI cues and global yields.",
  },
  {
    title: "Sensex breadth improves; banks and IT lead afternoon trade",
    link: "https://www.moneycontrol.com/news/business/markets/",
    source: "Markets Desk",
    publishedAt: new Date().toUTCString(),
    summary:
      "Domestic institutions remain net buyers amid mixed global risk appetite.",
  },
  {
    title: "Structured products: demand steady for principal-protected notes",
    link: "https://www.anandrathiwealth.in/",
    source: "SP Intelligence",
    publishedAt: new Date().toUTCString(),
    summary:
      "UHNI allocations tilt toward defined-outcome structures in volatile weeks.",
  },
  {
    title: "Rupee tracks dollar index; crude remains a key watchpoint",
    link: "https://economictimes.indiatimes.com/markets/forex",
    source: "FX Desk",
    publishedAt: new Date().toUTCString(),
    summary:
      "INR stays range-bound; importers hedge ahead of month-end settlements.",
  },
];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feeds = await Promise.all([
    fetchRss(
      "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      "Economic Times"
    ),
    fetchRss(
      "https://www.moneycontrol.com/rss/marketreports.xml",
      "Moneycontrol"
    ),
    fetchRss(
      "https://www.business-standard.com/rss/markets-106.rss",
      "Business Standard"
    ),
  ]);

  const merged = feeds
    .flat()
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 12);

  return NextResponse.json({
    news: merged.length > 0 ? merged : FALLBACK_NEWS,
    fetchedAt: new Date().toISOString(),
  });
}
