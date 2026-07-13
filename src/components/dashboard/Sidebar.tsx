"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  BarChart3,
} from "lucide-react";
import { MODULES } from "@/data/modules";
import { useTheme } from "@/components/theme/ThemeProvider";

type Props = {
  userName: string;
  userEmail: string;
};

export function Sidebar({ userName, userEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    "primary-sp": true,
  });

  const initials = useMemo(() => {
    return userName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [userName]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`relative flex h-screen flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] transition-all duration-300 ${
        collapsed ? "w-[78px]" : "w-[280px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          {collapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111] text-sm font-bold text-[#d4b24c]">
              AR
            </div>
          ) : (
            <Image
              src="/brand/arwl-logo.png"
              alt="Anand Rathi Wealth"
              width={170}
              height={38}
              className="h-8 w-auto dark:brightness-110"
            />
          )}
        </Link>
        <button
          type="button"
          className="btn-ghost !p-2"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        <Link
          href="/dashboard"
          className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            pathname === "/dashboard"
              ? "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[var(--fg)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
          }`}
        >
          <LayoutDashboard size={18} className="shrink-0 text-[var(--gold-deep)] dark:text-[var(--gold)]" />
          {!collapsed ? <span className="font-medium">Home Terminal</span> : null}
        </Link>

        {!collapsed ? (
          <p className="mb-2 mt-5 px-3 text-[10px] font-semibold tracking-[0.22em] text-[var(--fg-subtle)]">
            MODULES
          </p>
        ) : null}

        {MODULES.map((mod) => {
          const open = openModules[mod.id];
          const active = pathname.startsWith(mod.href);
          return (
            <div key={mod.id} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setOpenModules((s) => ({ ...s, [mod.id]: !s[mod.id] }))
                }
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-[var(--bg-muted)] text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
                }`}
              >
                <BarChart3 size={18} className="shrink-0 text-[var(--gold-deep)] dark:text-[var(--gold)]" />
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {mod.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition ${open ? "rotate-180" : ""}`}
                    />
                  </>
                ) : null}
              </button>
              {!collapsed && open ? (
                <div className="ml-4 border-l border-[var(--border)] pl-2">
                  {mod.submodules.map((sub) => {
                    const subActive = pathname === sub.path;
                    return (
                      <Link
                        key={sub.id}
                        href={sub.path}
                        className={`my-0.5 block rounded-lg px-3 py-2 text-[13px] transition ${
                          subActive
                            ? "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[var(--fg)]"
                            : "text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                        }`}
                        title={sub.description}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className={`mb-3 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient text-xs font-bold text-[#111]">
            {initials}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-[11px] text-[var(--fg-subtle)]">
                {userEmail}
              </p>
            </div>
          ) : null}
        </div>
        <div className={`flex gap-2 ${collapsed ? "flex-col" : ""}`}>
          <button
            type="button"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed ? (theme === "dark" ? "Light" : "Dark") : null}
          </button>
          <button
            type="button"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
            onClick={logout}
          >
            <LogOut size={16} />
            {!collapsed ? "Sign out" : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
