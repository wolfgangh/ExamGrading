"use client";

import { cn } from "@/lib/utils";

export type PageSectionLink = {
  id: string;
  label: string;
};

/**
 * Horizontale Sprungmarken zu In-Page-Ankern (#id).
 * Ziele sollten `scroll-mt-24` (o. ä.) haben.
 */
export function PageSectionNav({
  sections,
  className,
  ariaLabel = "Abschnitte auf dieser Seite",
}: {
  sections: PageSectionLink[];
  className?: string;
  ariaLabel?: string;
}) {
  const items = sections.filter((s) => s.id && s.label);
  if (items.length < 2) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-0 z-20 -mx-1 overflow-x-auto rounded-lg border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <ul className="flex min-w-min flex-wrap items-center gap-1.5">
        <li className="px-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          Springen
        </li>
        {items.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Gemeinsame Klasse für Anker-Ziele unter der sticky Nav */
export const SECTION_SCROLL_MT = "scroll-mt-24";
