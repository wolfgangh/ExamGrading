"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type PointsTab = "gesamt" | "aufgaben" | "auswertung";

/**
 * Reiter der Seite „Punkte“: Gesamt | je Aufgabe | Auswertung
 * (verbindet /points und /detail-points zu einem Menüpunkt).
 */
export function PointsTabs({
  examId,
  active,
  showTasks = true,
}: {
  examId: string;
  active: PointsTab;
  /** „je Aufgabe“ und „Auswertung“ nur mit Aufgaben-/Detailpunkten */
  showTasks?: boolean;
}) {
  const tabs: { id: PointsTab; label: string; href: string }[] = [
    { id: "gesamt", label: "Gesamt", href: `/exam/${examId}/points` },
    ...(showTasks
      ? [
          { id: "aufgaben" as const, label: "je Aufgabe", href: `/exam/${examId}/detail-points` },
          { id: "auswertung" as const, label: "Auswertung", href: `/exam/${examId}/detail-points?tab=auswertung` },
        ]
      : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label="Punkte"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1 border-b bg-background/95 px-1 pt-1 backdrop-blur"
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={t.id === active}
          className={cn(
            "-mb-px inline-flex items-center rounded-t-md border border-b-0 px-3 py-1.5 text-sm font-medium transition-colors",
            t.id === active
              ? "border-border bg-background text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
