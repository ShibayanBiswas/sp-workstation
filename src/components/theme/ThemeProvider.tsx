"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const STORAGE_KEY = "sp-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();

function emitThemeChange() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
}

function persistTheme(t: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
  emitThemeChange();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Syncs with localStorage without an effect-driven setState (avoids cascading renders).
  const theme = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    getServerSnapshot
  );

  // Keep the document class in sync with the store (DOM only — no setState).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    persistTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    persistTheme(readStoredTheme() === "dark" ? "light" : "dark");
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
