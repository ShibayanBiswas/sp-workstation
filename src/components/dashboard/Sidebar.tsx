"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  BarChart3,
  GraduationCap,
  Layers,
  Shield,
  Database,
} from "lucide-react";
import {
  MODULES,
  collectNavPaths,
  type ModuleGroup,
  type NavItem,
} from "@/data/modules";
import { useTheme } from "@/components/theme/ThemeProvider";
import { BrandLogo } from "@/components/ui/BrandLogo";

const MODULE_ICONS: Record<ModuleGroup["icon"], typeof BarChart3> = {
  chart: BarChart3,
  layers: Layers,
  shield: Shield,
  graduation: GraduationCap,
  database: Database,
};

type Props = {
  userName: string;
  userEmail: string;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function pathActive(pathname: string, path?: string) {
  if (!path) return false;
  return pathname === path;
}

function branchActive(pathname: string, item: NavItem) {
  return collectNavPaths(item).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function NavBranch({
  item,
  openMap,
  setOpenMap,
  collapsed,
  onNavigate,
  suppressExactActive = false,
}: {
  item: NavItem;
  openMap: Record<string, boolean>;
  setOpenMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** When a child shares the parent path (e.g. Options Lab + Home), parent wins. */
  suppressExactActive?: boolean;
}) {
  const pathname = usePathname();
  const hasChildren = Boolean(item.children?.length);
  const open = !collapsed && (openMap[item.id] ?? false);
  const active =
    !suppressExactActive && pathActive(pathname, item.path);
  const childActive = hasChildren && branchActive(pathname, item);

  const rowClass = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
    active
      ? "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[var(--fg)]"
      : childActive
        ? "text-[var(--fg)]"
        : "text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
  }`;

  const label = (
    <span className="sidebar-label min-w-0 flex-1 truncate text-[13px] font-medium">
      {item.label}
    </span>
  );

  return (
    <div className="my-0.5">
      <div className={rowClass}>
        {item.path ? (
          <Link
            href={item.path}
            className="min-w-0 flex-1 truncate"
            title={item.description || item.label}
            onClick={() => {
              onNavigate?.();
              if (hasChildren) {
                setOpenMap((s) => ({ ...s, [item.id]: true }));
              }
            }}
          >
            {label}
          </Link>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            title={item.description || item.label}
            onClick={() =>
              setOpenMap((s) => ({ ...s, [item.id]: !s[item.id] }))
            }
          >
            {label}
          </button>
        )}
        {hasChildren && !collapsed ? (
          <button
            type="button"
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={open}
            className="shrink-0 rounded-md p-1 text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            onClick={() =>
              setOpenMap((s) => ({ ...s, [item.id]: !s[item.id] }))
            }
          >
            <ChevronDown
              size={14}
              className={`transition ${open ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>

      {hasChildren && open ? (
        <div className="ml-3 border-l border-[var(--border)] pl-2">
          {item.children!.map((child) => (
            <NavBranch
              key={child.id}
              item={child}
              openMap={openMap}
              setOpenMap={setOpenMap}
              collapsed={collapsed}
              onNavigate={onNavigate}
              suppressExactActive={
                Boolean(
                  item.path && child.path && item.path === child.path
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  userName,
  userEmail,
  collapsed = false,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.id, true]))
  );
  const [openNav, setOpenNav] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    function walk(items: NavItem[]) {
      for (const item of items) {
        if (item.children?.length) {
          defaults[item.id] = true;
          walk(item.children);
        }
      }
    }
    for (const mod of MODULES) walk(mod.nav);
    return defaults;
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] px-3 py-3 md:px-4 md:py-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center justify-center lg:justify-start"
          onClick={onNavigate}
          title="Home Terminal"
        >
          {collapsed ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl gold-gradient text-xs font-bold text-[#111]">
              SP
            </span>
          ) : (
            <BrandLogo className="h-10 w-auto max-w-[200px] md:h-12 md:max-w-[220px]" />
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin md:py-4">
        <Link
          href="/dashboard"
          title="Home Terminal"
          onClick={onNavigate}
          className={`sidebar-nav-item panel-hover mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
            collapsed ? "justify-center px-2" : ""
          } ${
            pathname === "/dashboard"
              ? "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[var(--fg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold)_35%,var(--border))]"
              : "text-[var(--fg-muted)]"
          }`}
        >
          <LayoutDashboard size={18} className="shrink-0 text-[var(--gold-deep)] dark:text-[var(--gold)]" />
          <span className="sidebar-label font-medium">Home Terminal</span>
        </Link>

        {!collapsed ? (
          <p className="mb-2 mt-5 px-3 text-[10px] font-semibold tracking-[0.22em] text-[var(--fg-subtle)]">
            MODULES
          </p>
        ) : (
          <div className="my-3 h-px bg-[var(--border)]" />
        )}

        {MODULES.map((mod) => {
          const open = !collapsed && (openModules[mod.id] ?? false);
          const active = pathname.startsWith(mod.href);
          const ModuleIcon = MODULE_ICONS[mod.icon];
          return (
            <div key={mod.id} className="mb-1">
              <div
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition ${
                  collapsed ? "justify-center px-1" : ""
                } ${
                  active
                    ? "bg-[var(--bg-muted)] text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
                }`}
              >
                <Link
                  href={mod.href}
                  className={`flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 ${collapsed ? "justify-center" : "flex-1"}`}
                  title={mod.label}
                  onClick={onNavigate}
                >
                  <ModuleIcon size={18} className="shrink-0 text-[var(--gold-deep)] dark:text-[var(--gold)]" />
                  <span className="sidebar-label min-w-0 flex-1 truncate font-medium">
                    {mod.label}
                  </span>
                </Link>
                {!collapsed ? (
                  <button
                    type="button"
                    aria-label={open ? `Collapse ${mod.label}` : `Expand ${mod.label}`}
                    aria-expanded={open}
                    className="shrink-0 rounded-md p-1.5 text-[var(--fg-subtle)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
                    onClick={() =>
                      setOpenModules((s) => ({ ...s, [mod.id]: !s[mod.id] }))
                    }
                  >
                    <ChevronDown
                      size={14}
                      className={`transition ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : null}
              </div>

              {open ? (
                <div className="ml-4 mt-1 border-l border-[var(--border)] pl-2">
                  {mod.nav.map((item) => (
                    <NavBranch
                      key={item.id}
                      item={item}
                      openMap={openNav}
                      setOpenMap={setOpenNav}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className={`mb-3 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gold-gradient text-xs font-bold text-[#111]"
            title={userName}
          >
            {initials}
          </div>
          <div className="sidebar-label min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-[var(--fg-subtle)]">
              {userEmail}
            </p>
          </div>
        </div>
        <div className={`flex gap-2 ${collapsed ? "flex-col" : ""}`}>
          <button
            type="button"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
            onClick={toggleTheme}
            title={theme === "dark" ? "Light" : "Dark"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="sidebar-label">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <button
            type="button"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="sidebar-label">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
