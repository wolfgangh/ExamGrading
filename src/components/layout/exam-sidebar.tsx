"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  GitMerge,
  Grid3x3,
  Layers,
  PenLine,
  Settings,
  Table2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExamType } from "@/lib/types";

const NAV_BASE = [
  { href: "overview", label: "Übersicht", icon: BarChart3 },
  { href: "import", label: "Importe", icon: FileSpreadsheet },
  { href: "points", label: "Punkteerfassung", icon: PenLine },
  { href: "detail-points", label: "Detailpunkte", icon: Grid3x3 },
  { href: "grades", label: "Notenübersicht", icon: Table2 },
  { href: "scenarios", label: "Notenszenarien", icon: Layers },
  { href: "documents", label: "Dokumente", icon: FileText },
  { href: "export", label: "Export", icon: Download },
  { href: "settings", label: "Einstellungen", icon: Settings },
] as const;

export function ExamSidebar({
  examId,
  examType,
}: {
  examId: string;
  examType?: ExamType;
}) {
  const pathname = usePathname();
  const base = `/exam/${examId}`;

  const nav = [
    ...NAV_BASE.slice(0, 2),
    ...(examType === "the"
      ? ([{ href: "matching", label: "Zuordnung", icon: GitMerge }] as const)
      : []),
    ...NAV_BASE.slice(2),
  ];

  return (
    <aside className="surface-panel flex w-56 shrink-0 flex-col border-r">
      <div className="border-b p-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full justify-start gap-2"
          )}
          title="Zur Übersicht aller Prüfungen"
        >
          <ArrowLeft className="size-4 shrink-0" />
          Zurück
        </Link>
      </div>
      <div className="border-b px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="size-3.5" />
          Prüfung
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const path = `${base}/${href}`;
          const active = pathname === path || pathname.startsWith(path + "/");
          return (
            <Link
              key={href}
              href={path}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
