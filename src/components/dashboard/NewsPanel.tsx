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

  const [featured, ...rest] = news;

  return (
    <div className="glass-panel flex h-full flex-col rounded-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Newspaper
          size={18}
          className="text-[var(--gold-deep)] dark:text-[var(--gold)]"
        />
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
            INDIAN MARKETS
          </p>
          <h3
            className="text-lg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Financial news of the day
          </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <>
            {featured ? (
              <a
                href={featured.link}
                target="_blank"
                rel="noreferrer"
                className="group mb-4 block rounded-xl border border-[color-mix(in_srgb,var(--gold)_25%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_6%,var(--bg-muted))] p-4 transition hover:border-[var(--gold)]"
              >
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--gold-deep)] dark:text-[var(--gold)]">
                  TOP STORY
                </p>
                <p className="mt-2 text-base font-medium leading-snug group-hover:text-[var(--gold-deep)] dark:group-hover:text-[var(--gold-soft)]">
                  {featured.title}
                </p>
                {featured.summary ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--fg-muted)]">
                    {featured.summary}
                  </p>
                ) : null}
                <p className="mt-3 text-[10px] text-[var(--fg-subtle)]">
                  {featured.source}
                </p>
              </a>
            ) : null}

            <div className="space-y-1">
              {rest.map((item, idx) => (
                <a
                  key={`${item.link}-${item.title}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-[var(--border)] hover:bg-[var(--bg-muted)]"
                >
                  <span className="mt-0.5 w-5 shrink-0 text-[10px] font-bold tabular-nums text-[var(--fg-subtle)]">
                    {String(idx + 2).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug group-hover:text-[var(--gold-deep)] dark:group-hover:text-[var(--gold-soft)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--fg-subtle)]">
                      {item.source} ·{" "}
                      {new Date(item.publishedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <ExternalLink
                    size={12}
                    className="mt-1 shrink-0 opacity-30 group-hover:opacity-100"
                  />
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
