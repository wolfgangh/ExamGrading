"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  PenLine,
  Settings,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "overview", label: "Übersicht", icon: BarChart3 },
  { href: "import", label: "Importe", icon: FileSpreadsheet },
  { href: "points", label: "Punkteerfassung", icon: PenLine },
  { href: "grades", label: "Notenübersicht", icon: Table2 },
  { href: "export", label: "Export", icon: Download },
  { href: "settings", label: "Einstellungen", icon: Settings },
] as const;

export function ExamSidebar({ examId }: { examId: string }) {
  const pathname = usePathname();
  const base = `/exam/${examId}`;

  return (
    <aside className="surface-panel flex w-56 shrink-0 flex-col border-r">
      <div className="border-b px-3 py-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="size-3.5" />
          Prüfung
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
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
      <div className="mt-auto border-t p-3">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Alle Prüfungen
        </Link>
      </div>
    </aside>
  );
}
