"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary?: string;
};

export function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/news");
        const data = await res.json();
        if (alive) setNews(data.news || []);
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="glass-panel flex h-full flex-col rounded-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Newspaper size={18} className="text-[var(--gold-deep)] dark:text-[var(--gold)]" />
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
            INDIAN MARKETS
          </p>
          <h3 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
            Financial news of the day
          </h3>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {loading ? (
          <p className="text-sm text-[var(--fg-subtle)]">Loading headlines…</p>
        ) : (
          news.map((item) => (
            <a
              key={`${item.link}-${item.title}`}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-xl border border-transparent p-3 transition hover:border-[var(--border)] hover:bg-[var(--bg-muted)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug group-hover:text-[var(--gold-deep)] dark:group-hover:text-[var(--gold-soft)]">
                  {item.title}
                </p>
                <ExternalLink
                  size={14}
                  className="mt-0.5 shrink-0 opacity-40 group-hover:opacity-100"
                />
              </div>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--fg-subtle)]">
                  {item.summary}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] tracking-wide text-[var(--fg-subtle)]">
                {item.source} ·{" "}
                {new Date(item.publishedAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
