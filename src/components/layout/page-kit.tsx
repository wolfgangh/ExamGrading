"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Einheitlicher Seitenkopf: Titel, ein Satz Zweck, Hauptaktion rechts.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/**
 * Status-Hinweis – nur anzeigen, wenn etwas offen oder gesperrt ist.
 */
export function StatusNotice({
  tone = "info",
  children,
  href,
  linkLabel,
  className,
}: {
  tone?: "info" | "warning" | "success";
  children: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone === "warning" &&
          "border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50",
        tone === "success" &&
          "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50",
        tone === "info" && "border-border bg-muted/40",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 font-medium underline-offset-2 hover:underline"
        >
          {linkLabel ?? "Öffnen"}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * „Weitere Optionen“ – selten Genutztes eingeklappt.
 */
export function MoreOptions({
  label = "Weitere Optionen",
  children,
  defaultOpen = false,
  className,
}: {
  label?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn("group rounded-lg border bg-card/40", className)}
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        {label}
      </summary>
      <div className="space-y-4 border-t px-3 py-3">{children}</div>
    </details>
  );
}

export type PageTab = { id: string; label: ReactNode; badge?: ReactNode };

/** Reiter-Zustand mit ?tab=… in der URL (Deep-Link, Zurück-Taste). */
export function useTabParam(
  tabs: readonly { id: string }[],
  fallback?: string
): [string, (id: string) => void] {
  const first = fallback ?? tabs[0]?.id ?? "";
  const [tab, setTabState] = useState(first);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) setTabState(fromUrl);
    // nur beim ersten Laden aus der URL lesen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab) && tabs[0]) setTabState(tabs[0].id);
  }, [tabs, tab]);
  const setTab = useCallback((id: string) => {
    setTabState(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }, []);
  return [tab, setTab];
}

/** Reiterleiste (Tablist); Inhalt rendert die Seite je nach aktivem Reiter. */
export function PageTabs({
  tabs,
  value,
  onChange,
  className,
  ariaLabel = "Bereiche",
}: {
  tabs: PageTab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "sticky top-0 z-20 -mx-1 flex flex-wrap gap-1 border-b bg-background/95 px-1 pt-1 backdrop-blur",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-muted px-1.5 text-[0.7rem] tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Schritt im Ablauf (Import): Status, Titel, eingeklappt wenn erledigt.
 */
export function StepCard({
  index,
  title,
  status,
  summary,
  open,
  onToggle,
  children,
  id,
}: {
  index: number;
  title: ReactNode;
  status: "done" | "open" | "locked";
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            status === "done" && "bg-emerald-600 text-white",
            status === "open" && "bg-primary text-primary-foreground",
            status === "locked" && "bg-muted text-muted-foreground"
          )}
        >
          {status === "done" ? "✓" : index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          {summary && (
            <span className="block truncate text-sm text-muted-foreground">{summary}</span>
          )}
        </span>
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-3 border-t px-4 py-4">{children}</div>}
    </section>
  );
}
