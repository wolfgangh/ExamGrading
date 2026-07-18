"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitMerge,
  Grid3x3,
  HardDrive,
  Layers,
  ListChecks,
  PenLine,
  Settings,
  Table2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isOnlineStyleExam, type ExamType } from "@/lib/types";
import { useExamContext } from "@/components/exam/exam-context";
import {
  buildWorkflowSteps,
  workflowProgress,
} from "@/lib/workflow-steps";

const NAV_BASE = [
  { href: "overview", label: "Übersicht", icon: BarChart3 },
  { href: "import", label: "Importe", icon: FileSpreadsheet },
  { href: "points", label: "Punkteerfassung", icon: PenLine },
  { href: "detail-points", label: "Detailpunkte", icon: Grid3x3 },
  { href: "grades", label: "Notenübersicht", icon: Table2 },
  { href: "scenarios", label: "Notenszenarien", icon: Layers },
  { href: "documents", label: "Dokumente", icon: FileText },
  { href: "export", label: "Sicherung", icon: HardDrive },
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
  const { project, rows, stats } = useExamContext();

  const nav = [
    ...NAV_BASE.slice(0, 2),
    ...(examType && isOnlineStyleExam(examType)
      ? ([{ href: "matching", label: "Zuordnung", icon: GitMerge }] as const)
      : []),
    ...NAV_BASE.slice(2),
  ];

  const steps =
    project && stats
      ? buildWorkflowSteps(project, rows, stats, examId)
      : [];
  const progress = steps.length > 0 ? workflowProgress(steps) : null;

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

      {progress && (
        <div className="mt-auto border-t p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecks className="size-3.5" />
            Workflow
          </div>
          <p className="text-xs tabular-nums text-foreground">
            {progress.doneCount}/{progress.totalCount} erledigt
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.doneCount === progress.totalCount
                  ? "bg-emerald-600"
                  : "bg-primary"
              )}
              style={{ width: `${progress.progressPct}%` }}
            />
          </div>
          {progress.nextOpen ? (
            <Link
              href={progress.nextOpen.href}
              className="mt-2 block text-xs leading-snug text-muted-foreground hover:text-foreground"
            >
              Als Nächstes:{" "}
              <span className="font-medium text-foreground">
                {progress.nextOpen.label}
              </span>
              {progress.nextOpen.critical ? (
                <span className="text-amber-700 dark:text-amber-300">
                  {" "}
                  · erforderlich
                </span>
              ) : null}
            </Link>
          ) : (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Workflow abgeschlossen
            </p>
          )}
          <Link
            href={`${base}/overview`}
            className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Details in Übersicht
          </Link>
        </div>
      )}
    </aside>
  );
}
