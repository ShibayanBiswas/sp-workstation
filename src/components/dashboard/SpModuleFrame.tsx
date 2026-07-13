"use client";

type Props = {
  title: string;
  description: string;
  src: string;
};

export function SpModuleFrame({ title, description, src }: Props) {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-[var(--fg-subtle)]">
            PRIMARY SP DASHBOARD
          </p>
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{description}</p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost text-sm"
        >
          Open in new tab
        </a>
      </div>
      <div className="glass-panel min-h-0 flex-1 overflow-hidden rounded-2xl">
        <iframe
          title={title}
          src={src}
          className="h-full w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
