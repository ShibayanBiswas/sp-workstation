"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Poll interval while waiting for JWT expiry (also catches clock skew / revoked cookies). */
const POLL_MS = 60_000;
/** Sign out this many ms before JWT exp so the next request never races expiry. */
const SKEW_MS = 5_000;

type MeResponse = {
  authenticated?: boolean;
  expiresAt?: number | null;
};

/**
 * Keeps the open dashboard tab signed out when the 12h session ends —
 * even if the user never navigates. Also re-checks on tab focus.
 */
export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const signingOut = useRef(false);
  const expiryTimer = useRef<number | null>(null);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still leave the tab */
    }
    router.replace("/login?reason=session_expired");
    router.refresh();
  }, [router]);

  const scheduleExpiry = useCallback(
    (expiresAtSec: number | null | undefined) => {
      if (expiryTimer.current != null) {
        window.clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
      if (expiresAtSec == null || !Number.isFinite(expiresAtSec)) return;
      const msLeft = expiresAtSec * 1000 - Date.now() - SKEW_MS;
      if (msLeft <= 0) {
        void signOut();
        return;
      }
      expiryTimer.current = window.setTimeout(() => {
        void signOut();
      }, msLeft);
    },
    [signOut]
  );

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        await signOut();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as MeResponse;
      if (!data.authenticated) {
        await signOut();
        return;
      }
      scheduleExpiry(data.expiresAt);
    } catch {
      /* network blip — keep session; next poll retries */
    }
  }, [scheduleExpiry, signOut]);

  useEffect(() => {
    void checkSession();
    const pollId = window.setInterval(() => {
      void checkSession();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(pollId);
      if (expiryTimer.current != null) window.clearTimeout(expiryTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [checkSession, pathname]);

  return null;
}
