"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import {
  isOnlineStyleExam,
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
  type ExamProject,
  type ExamType,
} from "@/lib/types";
import { useExamContext } from "@/components/exam/exam-context";
import {
  buildWorkflowSteps,
  workflowProgress,
} from "@/lib/workflow-steps";
import { Button, buttonVariants } from "@/components/ui/button";
import { portfolioUsesGradeScenarios } from "@/lib/grades/portfolio";

const SIDEBAR_COLLAPSED_KEY = "examgrade-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
};

function buildNav(
  examType?: ExamType,
  project?: ExamProject | null
): NavItem[] {
  const items: NavItem[] = [
    { href: "overview", label: "Übersicht", icon: BarChart3 },
    { href: "import", label: "Importe", icon: FileSpreadsheet },
  ];

  if (examType && isOnlineStyleExam(examType)) {
    items.push({ href: "matching", label: "Zuordnung", icon: GitMerge });
  }

  if (examType && isStaCriteriaExam(examType)) {
    items.push({
      href: "assessment",
      label: "Kriterienbewertung",
      icon: ClipboardList,
    });
  } else if (examType && isPortfolioExam(examType)) {
    items.push({
      href: "assessment",
      label: "Teilnoten",
      icon: ClipboardList,
    });
  } else if (!(examType && isStaManualExam(examType))) {
    items.push({ href: "points", label: "Punkteerfassung", icon: PenLine });
    items.push({
      href: "detail-points",
      label: "Detailpunkte",
      icon: Grid3x3,
    });
  }

  items.push({ href: "grades", label: "Notenübersicht", icon: Table2 });

  // Notenszenarien: Klausur/THE/StA-Kriterien + Portfolio mit Punkte/Prozent-TLs
  const showScenarios =
    examType &&
    !isStaManualExam(examType) &&
    (!isPortfolioExam(examType) ||
      (project != null && portfolioUsesGradeScenarios(project)) ||
      // Portfolio ohne geladenes Project: Link trotzdem zeigen wenn Kriterienmodus
      (isPortfolioExam(examType) && project?.portfolioCriteriaMode === true));

  if (showScenarios) {
    items.push({ href: "scenarios", label: "Notenszenarien", icon: Layers });
  }

  items.push(
    { href: "documents", label: "Dokumente", icon: FileText },
    { href: "export", label: "Sicherung", icon: HardDrive },
    { href: "settings", label: "Einstellungen", icon: Settings }
  );

  return items;
}

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
  const nav = buildNav(examType ?? project?.examType, project);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const steps =
    project && stats
      ? buildWorkflowSteps(project, rows, stats, examId)
      : [];
  const progress = steps.length > 0 ? workflowProgress(steps) : null;

  return (
    <aside
      className={cn(
        "surface-panel flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b p-2">
        {!collapsed && (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-w-0 flex-1 justify-start gap-2"
            )}
            title="Zur Übersicht aller Prüfungen"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Zurück
          </Link>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className={cn(collapsed && "mx-auto")}
          onClick={toggleCollapsed}
          title={collapsed ? "Navigation einblenden" : "Navigation ausblenden"}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Navigation einblenden" : "Navigation ausblenden"
          }
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>
      {!collapsed && (
        <div className="shrink-0 border-b px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Prüfung
          </p>
        </div>
      )}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const path = `${base}/${href}`;
          const active = pathname === path || pathname.startsWith(path + "/");
          return (
            <Link
              key={href}
              href={path}
              title={label}
              className={cn(
                "flex items-center gap-2 rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {progress && !collapsed && (
        <div className="shrink-0 border-t bg-card/80 p-3 backdrop-blur-sm">
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
