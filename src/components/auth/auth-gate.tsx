"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LoginScreen } from "@/components/auth/login-screen";
import { TeamsEmbedBanner } from "@/components/layout/teams-embed-banner";
import {
  AUTH_CHANGE_EVENT,
  isAuthenticated,
} from "@/lib/app-auth";

/**
 * Schützt die gesamte Client-App hinter dem Login-Screen.
 * Session: sessionStorage (endet mit Browser-Tab/Fenster).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(() => {
    setAuthed(isAuthenticated());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(AUTH_CHANGE_EVENT, onChange);
    // storage-Event greift nicht für sessionStorage im gleichen Tab;
    // AUTH_CHANGE_EVENT deckt Logout/Login ab.
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  }, [refresh]);

  if (!ready) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Laden…
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onSuccess={refresh} />;
  }

  return (
    <>
      <TeamsEmbedBanner />
      {children}
    </>
  );
}
