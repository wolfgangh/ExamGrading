"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number | (string | number)[];
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (
    label: string | number,
    payload: TooltipPayloadItem[]
  ) => ReactNode;
  formatter?: (
    value: string | number | (string | number)[] | undefined,
    name: string | number | undefined,
    item: TooltipPayloadItem,
    index: number,
    payload: TooltipPayloadItem[]
  ) => ReactNode | [ReactNode, ReactNode];
  className?: string;
};

/**
 * Theme-fähiger Recharts-Tooltip (vermeidet weißen Default-Hintergrund).
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const title =
    labelFormatter && label != null
      ? labelFormatter(label, payload)
      : label != null
        ? String(label)
        : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
        className
      )}
    >
      {title != null && title !== "" && (
        <p className="mb-1 font-semibold text-popover-foreground">{title}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((item, index) => {
          const rawName = item.name ?? item.dataKey;
          let displayValue: ReactNode =
            item.value == null
              ? "–"
              : Array.isArray(item.value)
                ? item.value.join(", ")
                : String(item.value);
          let displayName: ReactNode =
            rawName != null ? String(rawName) : "Wert";

          if (formatter) {
            const formatted = formatter(
              item.value,
              rawName,
              item,
              index,
              payload
            );
            if (Array.isArray(formatted)) {
              displayValue = formatted[0];
              displayName = formatted[1];
            } else if (formatted != null) {
              displayValue = formatted;
            }
          }

          return (
            <li
              key={`${String(rawName)}-${index}`}
              className="flex items-center gap-2 tabular-nums text-popover-foreground"
            >
              {item.color && (
                <span
                  className="inline-block size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
              )}
              <span className="text-muted-foreground">{displayName}:</span>
              <span className="font-medium">{displayValue}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const chartTooltipCursor = {
  fill: "var(--muted)",
  opacity: 0.35,
} as const;
