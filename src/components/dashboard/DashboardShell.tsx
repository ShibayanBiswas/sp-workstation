"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SessionGuard } from "@/components/auth/SessionGuard";

type ShellContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useDashboardShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useDashboardShell must be used within DashboardShell");
  }
  return ctx;
}

type Props = {
  userName: string;
  userEmail: string;
  children: ReactNode;
};

const COLLAPSE_KEY = "sp-sidebar-collapsed";

export function DashboardShell({ userName, userEmail, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      setCollapsed(stored === "1");
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Close the mobile drawer on resize up to desktop.
    function onResize() {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, toggleCollapsed, setMobileOpen }),
    [collapsed, mobileOpen, toggleCollapsed]
  );

  return (
    <ShellContext.Provider value={value}>
      <SessionGuard />
      <div className={`dashboard-shell dashboard-shell-alive ${collapsed ? "dashboard-shell-collapsed" : ""} ${ready ? "dashboard-shell-ready" : ""}`}>
        {/* Mobile top bar */}
        <header className="dashboard-mobile-bar lg:hidden">
          <button
            type="button"
            className="dashboard-icon-btn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <span className="truncate text-xs font-semibold tracking-[0.18em] text-[var(--fg-subtle)]">
            SP WORKSTATION
          </span>
          <span className="h-9 w-9" aria-hidden />
        </header>

        {/* Desktop / drawer sidebar */}
        <aside
          className={`dashboard-sidebar ${mobileOpen ? "dashboard-sidebar-open" : ""}`}
          aria-label="Main navigation"
        >
          <div className="dashboard-sidebar-toolbar hidden lg:flex">
            <button
              type="button"
              className="dashboard-icon-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          <Sidebar
            userName={userName}
            userEmail={userEmail}
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="dashboard-sidebar-backdrop lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <main className="dashboard-main">{children}</main>
      </div>
    </ShellContext.Provider>
  );
}
