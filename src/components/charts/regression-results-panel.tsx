"use client";

import type { ReactNode } from "react";
import type { LinearRegressionResult } from "@/lib/grades/linear-regression";
import {
  regressionCoefficientRows,
  regressionFitRows,
  type DurationYMode,
} from "@/lib/grades/duration-points-analysis";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Mathematische Formel mit serifenähnlicher Darstellung (ohne KaTeX). */
function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2 font-serif text-[0.95em] leading-relaxed tracking-wide text-foreground">
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <sub className="text-[0.75em]">{children}</sub>;
}

function Sup({ children }: { children: ReactNode }) {
  return <sup className="text-[0.75em]">{children}</sup>;
}

export function RegressionResultsPanel({
  regression,
  yMode,
  yUnitShort,
  slopeUnit,
  maxPoints,
}: {
  regression: LinearRegressionResult;
  yMode: DurationYMode;
  yUnitShort: string;
  slopeUnit: string;
  maxPoints: number;
}) {
  const coefRows = regressionCoefficientRows(regression, {
    yUnitShort,
    slopeUnit,
    yMode,
  });
  const fitRows = regressionFitRows(regression);
  const yLabel =
    yMode === "percent" ? `% von max. (${maxPoints} Pkt.)` : "Punkte";

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
      <div>
        <p className="mb-1.5 font-medium">Lineares Modell</p>
        <Formula>
          <span className="italic">ŷ</span>
          {" = a + b · t"}
          <span className="mt-1 block font-sans text-[0.85em] text-muted-foreground not-italic">
            t = Bearbeitungsdauer (min),{" "}
            <span className="italic">ŷ</span> = {yLabel}
          </span>
        </Formula>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Schätzung (OLS)
          </p>
          <Formula>
            <span className="block">
              b = Σ (t<sub className="text-[0.75em]">i</sub> − t̄)(y
              <sub className="text-[0.75em]">i</sub> − ȳ) / Σ (t
              <sub className="text-[0.75em]">i</sub> − t̄)<Sup>2</Sup>
            </span>
            <span className="mt-1 block">
              a = ȳ − b · t̄
            </span>
          </Formula>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Hypothesentest (zweiseitig)
          </p>
          <Formula>
            <span className="block">
              H<sub className="text-[0.75em]">0</sub>: a = 0 bzw. b = 0
            </span>
            <span className="mt-1 block">
              t = Koeffizient / SE ,{" "}
              df = n − 2
            </span>
            <span className="mt-1 block font-sans text-[0.85em] text-muted-foreground not-italic">
              p-Wert aus Student-t-Verteilung
            </span>
          </Formula>
        </div>
      </div>

      <div>
        <p className="mb-1.5 font-medium">Koeffizienten</p>
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-14">Symbol</TableHead>
                <TableHead className="text-right">Wert</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead className="text-right">SE</TableHead>
                <TableHead className="text-right">t</TableHead>
                <TableHead className="text-right">p-Wert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coefRows.map((row) => (
                <TableRow key={row.symbol}>
                  <TableCell className="font-medium whitespace-normal">
                    {row.name}
                  </TableCell>
                  <TableCell className="font-serif italic">{row.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.value}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.se}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.t}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.pValue}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          SE = Standardfehler · p-Werte zweiseitig gegen H
          <Sub>0</Sub>: Koeffizient = 0
        </p>
      </div>

      <div>
        <p className="mb-1.5 font-medium">Gütemaße und Stichprobe</p>
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-14">Symbol</TableHead>
                <TableHead className="text-right">Wert</TableHead>
                <TableHead>Hinweis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fitRows.map((row) => (
                <TableRow key={row.symbol + row.name}>
                  <TableCell className="font-medium whitespace-normal">
                    {row.name}
                  </TableCell>
                  <TableCell className="font-serif italic">{row.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.value}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {row.note ?? "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
