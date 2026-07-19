"use client";

type Props = {
  src: string;
  title?: string;
  frameTitle?: string;
};

export function SpModuleFrame({
  src,
  title = "PRIMARY SP DASHBOARD",
  frameTitle = "Primary SP Dashboard",
}: Props) {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--fg-subtle)]">
          {title}
        </p>
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
          title={frameTitle}
          src={src}
          className="h-full w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
