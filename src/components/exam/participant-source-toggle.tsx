"use client";

import { Landmark, UserPen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParticipantSources } from "@/lib/participant-sources";

const ITEMS: {
  key: keyof ParticipantSources;
  label: string;
  hint: string;
  Icon: typeof Landmark;
}[] = [
  {
    key: "his",
    label: "HISinOne",
    hint: "Teilnehmer aus HISinOne-Datei(en); Notenmeldung als HISinOne-Excel",
    Icon: Landmark,
  },
  {
    key: "manual",
    label: "Manuell",
    hint: "Teilnehmer selbst erfassen (Formular, Einfügen, Excel/CSV); Notenmeldung als Excel-Notenliste",
    Icon: UserPen,
  },
];

/**
 * Teilnehmer-Quelle als zwei Icon-Schalter (beide an = beides).
 * Mindestens eine Quelle bleibt aktiv.
 */
export function ParticipantSourceToggle({
  value,
  onToggle,
  size = "md",
  className,
}: {
  value: ParticipantSources;
  onToggle: (key: keyof ParticipantSources) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Teilnehmer-Quelle"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {ITEMS.map(({ key, label, hint, Icon }) => {
        const on = value[key];
        const onlyOne = on && !value[key === "his" ? "manual" : "his"];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            title={onlyOne ? `${hint} – mindestens eine Quelle bleibt aktiv` : hint}
            onClick={() => onToggle(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border-2 font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm",
              on
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
            {label}
            <span
              aria-hidden
              className={cn(
                "ml-0.5 inline-block rounded-full",
                size === "sm" ? "size-1.5" : "size-2",
                on ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
