"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  criterionDetailTooltip,
  criterionPlaceholder,
  criterionScaleShort,
  recomputeStaCriteriaRecord,
} from "@/lib/grades/sta-criteria";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  averageLecturerGradesForComponent,
  computePortfolioRawAverageForProject,
  criterionPointsTotals,
  disabledCriteriaForGroup,
  effectivePortfolioGrades,
  gradeFromUnitAvg,
  groupPortfolioFillStatus,
  resolveComponentCriteriaScale,
  shortLecturerLabel,
  unitAvgFromCriterionValues,
  unitAvgForPortfolioComponent,
} from "@/lib/grades/portfolio";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import {
  isPortfolioExam,
  isStaCriteriaExam,
  type EnrichedStudentRow,
  type PointsRecord,
} from "@/lib/types";
import { cn, formatGrade, formatPoints } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Search,
  Settings,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  GroupFilterBar,
  type GroupFillStatusMap,
} from "@/components/exam/group-filter-bar";
import { StudentGroupSelect } from "@/components/exam/student-group-select";
import {
  countInGroup,
  filterRowsByGroup,
  getGroupDisabledPortfolioCriteria,
  setGroupPortfolioCriterionDisabled,
  setStudentGroupId,
  setStudentGroupIds,
  sortedStudentGroups,
  type GroupFilterId,
} from "@/lib/student-groups";
import {
  personHasAssessmentValues,
  setStudentNotAttended,
} from "@/lib/grades/not-attended";
import {
  getAdjacentGermanGradeInfo,
  getNextGradeInfo,
} from "@/lib/grades/next-grade";
import type { CriterionScale, GradeSchema } from "@/lib/types";

/** Abstand zur nächsten Note für angezeigte TL-Unit (Schema-Punkte oder Notengrade). */
function tlNextFromUnit(
  unit: number | null | undefined,
  scale: CriterionScale | undefined,
  schema: GradeSchema | null | undefined
): {
  pointsToNext: number;
  nextGrade: number;
  direction: "better" | "worse";
} | null {
  if (unit == null || !Number.isFinite(unit)) return null;
  const u = Math.min(1, Math.max(0, unit));
  if (
    (scale === "points" || scale === "percent") &&
    schema != null &&
    schema.maxPoints > 0
  ) {
    const next = getNextGradeInfo(u * schema.maxPoints, schema);
    if (next.pointsNeeded == null || next.nextGrade == null) return null;
    if (!(next.pointsNeeded > 0)) return null;
    return {
      pointsToNext: next.pointsNeeded,
      nextGrade: next.nextGrade,
      direction: "better",
    };
  }
  const adj = getAdjacentGermanGradeInfo(5 - 4 * u);
  if (
    adj.pointsNeeded == null ||
    adj.nextGrade == null ||
    !(adj.pointsNeeded > 0) ||
    adj.direction == null
  ) {
    return null;
  }
  return {
    pointsToNext: adj.pointsNeeded,
    nextGrade: adj.nextGrade,
    direction: adj.direction,
  };
}

/** Ein Begriff oder mehrere (Komma/Semikolon/Zeilenumbruch = ODER) */
function matchesNameSearch(row: EnrichedStudentRow, query: string): boolean {
  const terms = query
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return true;
  const last = (row.student.lastName ?? "").toLowerCase();
  const first = (row.student.firstName ?? "").toLowerCase();
  const full = `${last}, ${first}`;
  const fullSpace = `${last} ${first}`;
  const mat = (row.key ?? "").toLowerCase();
  const hay = `${last} ${first} ${full} ${fullSpace} ${mat}`;
  return terms.some(
    (q) =>
      last.includes(q) ||
      first.includes(q) ||
      full.includes(q) ||
      fullSpace.includes(q) ||
      mat.includes(q) ||
      hay.includes(q)
  );
}

/** Tab/Shift+Tab: nächstes Kriterium in der Matrix-Zeile (nicht nächste Person). */
function handleMatrixInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Tab") return;
  // Base-UI / Event-Target: robust über closest, nicht nur currentTarget
  const current =
    (e.target instanceof Element
      ? e.target.closest("input[data-matrix-input]")
      : null) ?? e.currentTarget;
  if (!(current instanceof HTMLInputElement)) return;
  const row = current.closest("tr");
  if (!row) return;
  const inputs = [
    ...row.querySelectorAll<HTMLInputElement>(
      "input[data-matrix-input]:not([disabled])"
    ),
  ];
  if (inputs.length < 2) return;
  const idx = inputs.indexOf(current);
  if (idx < 0) return;
  e.preventDefault();
  e.stopPropagation();
  const nextIdx = e.shiftKey
    ? (idx - 1 + inputs.length) % inputs.length
    : (idx + 1) % inputs.length;
  const next = inputs[nextIdx];
  // Nach Blur/setState kann der Fokus verloren gehen – microtask + rAF absichern
  const focusNext = () => {
    next.focus({ preventScroll: true });
    next.select?.();
  };
  focusNext();
  queueMicrotask(focusNext);
  requestAnimationFrame(focusNext);
}

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { project, setProject, rows } = useExamContext();
  const [groupFilter, setGroupFilter] = useState<GroupFilterId>("all");
  const [nameQuery, setNameQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  /** Bei Portfolio-Kriterien × Dozenten: aktiver Bewerter */
  const [lecturerFilter, setLecturerFilter] = useState<string>("");
  /** Portfolio-Kriterienmodus: eine Teilleistung in der Matrix */
  const [componentFilter, setComponentFilter] = useState<string>("");
  /** Gleiche Werte für alle Mitglieder der gefilterten Gruppe */
  const [groupPerformance, setGroupPerformance] = useState(false);
  /** Kriterien-Deaktivierung pro Gruppe: Panel standardmäßig zu */
  const [criteriaDisableOpen, setCriteriaDisableOpen] = useState(false);
  const [highlightMat, setHighlightMat] = useState<string | null>(null);
  /** No-Shows (nicht angetreten) in der Matrix anzeigen */
  const [showNoShows, setShowNoShows] = useState(true);
  const matrixScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollMatrix = (dir: "left" | "right") => {
    const el = matrixScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === "right" ? 320 : -320,
      behavior: "smooth",
    });
  };

  // Deep-Link aus Notenübersicht: ?mat=&group=
  useEffect(() => {
    const mat = searchParams.get("mat")?.trim() || null;
    const group = searchParams.get("group")?.trim() || null;
    if (group === "all" || group === "none" || (group && group.length > 0)) {
      setGroupFilter(group as GroupFilterId);
      if (group && group !== "all" && group !== "none") {
        setGroupPerformance(true);
      }
    }
    if (mat) {
      setHighlightMat(mat);
      setNameQuery("");
      setShowNoShows(true); // No-Show-Deep-Link sichtbar machen
      const t = window.setTimeout(() => {
        const el = document.querySelector(
          `[data-mat-row="${CSS.escape(mat)}"]`
        );
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
      return () => window.clearTimeout(t);
    }
  }, [searchParams]);

  const criteria = project?.criteria ?? [];
  const components = project?.portfolioComponents ?? [];
  const portfolioCriteriaMode = project?.portfolioCriteriaMode === true;
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.student.lastName.localeCompare(b.student.lastName, "de")
      ),
    [rows]
  );
  const searchActive = nameQuery.trim().length > 0;
  const noShowCount = useMemo(
    () => sortedRows.filter((r) => r.status === "no_show").length,
    [sortedRows]
  );
  const filteredRows = useMemo(() => {
    // Bei aktiver Namenssuche über alle Gruppen – erleichtert die Zuordnung
    let base = searchActive
      ? sortedRows
      : filterRowsByGroup(sortedRows, groupFilter);
    if (searchActive) {
      base = base.filter((r) => matchesNameSearch(r, nameQuery));
    }
    if (!showNoShows) {
      base = base.filter((r) => r.status !== "no_show");
    }
    return base;
  }, [sortedRows, groupFilter, nameQuery, searchActive, showNoShows]);

  const isCriteria = project ? isStaCriteriaExam(project.examType) : false;
  const isPortfolio = project ? isPortfolioExam(project.examType) : false;
  const hasGroups =
    project != null && sortedStudentGroups(project).length > 0;
  const unassignedTotal = hasGroups
    ? countInGroup(sortedRows, "none")
    : 0;

  const visibleKeys = useMemo(
    () => filteredRows.map((r) => r.key),
    [filteredRows]
  );
  /** Mitglieder der konkret gewählten Gruppe (nicht Alle / Ohne Gruppe) */
  const groupMemberKeys = useMemo(() => {
    if (groupFilter === "all" || groupFilter === "none") return [] as string[];
    return filterRowsByGroup(sortedRows, groupFilter).map((r) => r.key);
  }, [sortedRows, groupFilter]);
  const concreteGroupSelected =
    groupFilter !== "all" &&
    groupFilter !== "none" &&
    groupMemberKeys.length > 0;
  /** Konkrete Gruppen-ID (Filter), für gruppenweise Kriterien-Deaktivierung */
  const selectedGroupId =
    groupFilter !== "all" && groupFilter !== "none" ? groupFilter : null;
  const selectedGroupName =
    selectedGroupId && project
      ? sortedStudentGroups(project).find((g) => g.id === selectedGroupId)
          ?.name
      : null;
  const groupPerformanceActive =
    isPortfolio && groupPerformance && concreteGroupSelected;

  const allVisibleSelected =
    visibleKeys.length > 0 &&
    visibleKeys.every((k) => selectedKeys.includes(k));
  const someVisibleSelected =
    visibleKeys.some((k) => selectedKeys.includes(k)) && !allVisibleSelected;

  const toggleKey = (key: string, on: boolean) => {
    setSelectedKeys((prev) =>
      on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)
    );
  };

  const toggleAllVisible = (on: boolean) => {
    setSelectedKeys((prev) => {
      if (on) {
        const set = new Set(prev);
        for (const k of visibleKeys) set.add(k);
        return [...set];
      }
      return prev.filter((k) => !visibleKeys.includes(k));
    });
  };

  const assignSelectedToGroup = (groupId: string | null) => {
    if (selectedKeys.length === 0) return;
    setProject((prev) => setStudentGroupIds(prev, selectedKeys, groupId));
    setSelectedKeys([]);
  };

  const setGroupFilterSafe = (id: GroupFilterId) => {
    setGroupFilter(id);
    if (id === "all" || id === "none") setGroupPerformance(false);
    setCriteriaDisableOpen(false);
  };

  /** Kriterienmodus: Füllstand nur für gewählte TL; sonst alle TLs */
  const fillScopeComponentId =
    isPortfolio && portfolioCriteriaMode && components.length > 0
      ? componentFilter && components.some((c) => c.id === componentFilter)
        ? componentFilter
        : components[0].id
      : null;
  const fillScopeLabel =
    isPortfolio && fillScopeComponentId
      ? (() => {
          const c = components.find((x) => x.id === fillScopeComponentId);
          return c ? c.code || c.name : undefined;
        })()
      : isPortfolio
        ? "alle Teilleistungen"
        : undefined;

  const groupFillStatus = useMemo((): GroupFillStatusMap | undefined => {
    if (!project || !isPortfolio || !hasGroups) return undefined;
    const pointsByKey = new Map(
      project.points.map((p) => [
        normalizeMatriculation(p.matriculationNumber),
        p,
      ])
    );
    const map: GroupFillStatusMap = {};
    for (const g of sortedStudentGroups(project)) {
      const memberKeys = sortedRows
        .filter((r) => r.student.groupId === g.id)
        .map((r) => r.key);
      const st = groupPortfolioFillStatus(
        project,
        memberKeys,
        (key) => pointsByKey.get(key),
        { groupId: g.id, componentId: fillScopeComponentId }
      );
      if (st !== "empty") map[g.id] = st;
    }
    return map;
  }, [
    project,
    isPortfolio,
    hasGroups,
    sortedRows,
    fillScopeComponentId,
  ]);

  if (!project) return null;

  if (!isCriteria && !isPortfolio) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6">
        <h1 className="text-xl font-semibold">Bewertung</h1>
        <p className="text-muted-foreground">
          Diese Seite gilt für „Studienarbeit (StA) – Kriterien“ und
          „Portfolioprüfung“.
        </p>
        <Link
          href={`/exam/${id}/overview`}
          className={buttonVariants({ variant: "outline" })}
        >
          Zur Übersicht
        </Link>
      </div>
    );
  }

  const setCriterionValue = (
    matKey: string,
    criterionId: string,
    raw: string
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    const value = num != null && Number.isFinite(num) ? num : null;
    setProject((prev) => {
      const criteriaList = prev.criteria ?? [];
      const max = prev.gradeSchema.maxPoints;
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === matKey
      );
      const base =
        idx >= 0
          ? prev.points[idx]
          : {
              matriculationNumber: matKey,
              bySubArea: Object.fromEntries(
                prev.subAreas.map((s) => [s.id, null])
              ),
              totalPoints: null as number | null,
              source: "manual" as const,
              criterionValues: {},
            };
      const criterionValues = {
        ...(base.criterionValues ?? {}),
        [criterionId]: value,
      };
      const next = recomputeStaCriteriaRecord(
        { ...base, criterionValues },
        criteriaList,
        max
      );
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  const emptyPointsBase = (matKey: string): PointsRecord => ({
    matriculationNumber: matKey,
    bySubArea: Object.fromEntries(
      (project?.subAreas ?? []).map((s) => [s.id, null])
    ),
    totalPoints: null,
    source: "manual",
  });

  const targetKeysForEdit = (matKey: string): string[] => {
    if (
      groupPerformanceActive &&
      groupMemberKeys.length > 0 &&
      groupMemberKeys.includes(matKey)
    ) {
      return groupMemberKeys;
    }
    return [matKey];
  };

  const mapPointsForKeys = (
    prev: typeof project,
    keys: string[],
    apply: (rec: PointsRecord) => PointsRecord
  ) => {
    if (!prev) return prev;
    const points = [...prev.points];
    for (const matKey of keys) {
      const idx = points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === matKey
      );
      const base = idx >= 0 ? points[idx] : emptyPointsBase(matKey);
      const next = apply(base);
      if (idx >= 0) points[idx] = next;
      else points.push(next);
    }
    return { ...prev, points };
  };

  const setPortfolioGrade = (
    matKey: string,
    componentId: string,
    raw: string
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    let value: number | null =
      num != null && Number.isFinite(num) ? num : null;
    if (value != null) value = Math.min(5, Math.max(1, value));
    const keys = targetKeysForEdit(matKey);
    setProject((prev) =>
      mapPointsForKeys(prev, keys, (base) => ({
        ...base,
        portfolioGrades: {
          ...(base.portfolioGrades ?? {}),
          [componentId]: value,
        },
        source: "manual" as const,
      }))
    );
  };

  const setPortfolioLecturerGrade = (
    matKey: string,
    componentId: string,
    lecturerName: string,
    raw: string
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    let value: number | null =
      num != null && Number.isFinite(num) ? num : null;
    if (value != null) value = Math.min(5, Math.max(1, value));
    const keys = targetKeysForEdit(matKey);
    setProject((prev) =>
      mapPointsForKeys(prev, keys, (base) => {
        const byL = { ...(base.portfolioGradesByLecturer ?? {}) };
        const perComp = { ...(byL[componentId] ?? {}) };
        perComp[lecturerName] = value;
        byL[componentId] = perComp;
        return {
          ...base,
          portfolioGradesByLecturer: byL,
          source: "manual" as const,
        };
      })
    );
  };

  const setPortfolioCriterionValue = (
    matKey: string,
    componentId: string,
    criterionId: string,
    raw: string,
    lecturerName?: string | null
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    const value = num != null && Number.isFinite(num) ? num : null;
    const keys = targetKeysForEdit(matKey);
    setProject((prev) =>
      mapPointsForKeys(prev, keys, (base) => {
        if (lecturerName) {
          const byL = { ...(base.portfolioCriterionValuesByLecturer ?? {}) };
          const perComp = { ...(byL[componentId] ?? {}) };
          const perLec = { ...(perComp[lecturerName] ?? {}) };
          perLec[criterionId] = value;
          perComp[lecturerName] = perLec;
          byL[componentId] = perComp;
          return {
            ...base,
            portfolioCriterionValuesByLecturer: byL,
            source: "manual" as const,
          };
        }
        const byC = { ...(base.portfolioCriterionValues ?? {}) };
        const per = { ...(byC[componentId] ?? {}) };
        per[criterionId] = value;
        byC[componentId] = per;
        return {
          ...base,
          portfolioCriterionValues: byC,
          source: "manual" as const,
        };
      })
    );
  };

  /** Alle Werte der aktuellen TL von einer Person auf die Gruppe kopieren */
  const copyActiveTlToGroup = () => {
    if (!project || groupMemberKeys.length === 0) return;
    const sourceKey =
      selectedKeys.find((k) => groupMemberKeys.includes(k)) ??
      groupMemberKeys[0];
    const sourceRec = project.points.find(
      (p) => normalizeMatriculation(p.matriculationNumber) === sourceKey
    );
    if (!sourceRec) return;

    const tlIds = portfolioCriteriaMode
      ? activeComponentId
        ? [activeComponentId]
        : []
      : components.map((c) => c.id);
    if (tlIds.length === 0) return;

    setProject((prev) => {
      if (!prev) return prev;
      let next = prev;
      for (const matKey of groupMemberKeys) {
        if (matKey === sourceKey) continue;
        next = mapPointsForKeys(next, [matKey], (base) => {
          let rec = { ...base, source: "manual" as const };
          for (const tlId of tlIds) {
            if (portfolioCriteriaMode) {
              if (perLecturer && activeLecturer) {
                const srcVals =
                  sourceRec.portfolioCriterionValuesByLecturer?.[tlId]?.[
                    activeLecturer
                  ] ?? {};
                const byL = {
                  ...(rec.portfolioCriterionValuesByLecturer ?? {}),
                };
                const perComp = { ...(byL[tlId] ?? {}) };
                perComp[activeLecturer] = { ...srcVals };
                byL[tlId] = perComp;
                rec = {
                  ...rec,
                  portfolioCriterionValuesByLecturer: byL,
                };
              } else {
                const srcVals =
                  sourceRec.portfolioCriterionValues?.[tlId] ?? {};
                const byC = { ...(rec.portfolioCriterionValues ?? {}) };
                byC[tlId] = { ...srcVals };
                rec = { ...rec, portfolioCriterionValues: byC };
              }
            } else if (perLecturer) {
              const byL = { ...(rec.portfolioGradesByLecturer ?? {}) };
              const perComp = { ...(byL[tlId] ?? {}) };
              const srcPer = sourceRec.portfolioGradesByLecturer?.[tlId] ?? {};
              byL[tlId] = { ...perComp, ...srcPer };
              rec = { ...rec, portfolioGradesByLecturer: byL };
            } else {
              const g = sourceRec.portfolioGrades?.[tlId] ?? null;
              rec = {
                ...rec,
                portfolioGrades: {
                  ...(rec.portfolioGrades ?? {}),
                  [tlId]: g,
                },
              };
            }
          }
          return rec;
        })!;
      }
      return next;
    });
  };

  const perLecturer =
    isPortfolio && project?.portfolioPerLecturerGrading === true;
  const lecturers = (project?.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  const activeLecturer =
    perLecturer && portfolioCriteriaMode
      ? lecturerFilter && lecturers.includes(lecturerFilter)
        ? lecturerFilter
        : lecturers[0] ?? ""
      : "";
  const activeComponentId =
    portfolioCriteriaMode && components.length > 0
      ? componentFilter && components.some((c) => c.id === componentFilter)
        ? componentFilter
        : components[0].id
      : "";
  const activeComponent =
    components.find((c) => c.id === activeComponentId) ?? null;
  /** Im Kriterienmodus nur die gewählte Teilleistung */
  const matrixComponents =
    portfolioCriteriaMode && activeComponent
      ? [activeComponent]
      : components;
  const cols = isPortfolio ? components : criteria;
  /** Flache Kriterien-Spalten (Portfolio-Kriterienmodus, aktuelle TL) */
  const portfolioCritColumns = portfolioCriteriaMode
    ? matrixComponents.flatMap((c) =>
        (c.criteria ?? []).map((k) => ({
          componentId: c.id,
          componentCode: c.code || c.name,
          criterion: k,
        }))
      )
    : [];
  /** Bei Gruppenfilter: deaktivierte Kriterien der gewählten Gruppe (aktive TL) */
  const groupDisabledCritIds =
    selectedGroupId && activeComponentId
      ? new Set(
          getGroupDisabledPortfolioCriteria(
            project,
            selectedGroupId,
            activeComponentId
          )
        )
      : new Set<string>();
  /** Kriterien der aktiven TL für Toggle-UI */
  const activeTlCriteria = activeComponent?.criteria ?? [];
  /** Anzahl Noten-/Werte-Spalten (ohne Name/Matr/Gruppe/Note) */
  const valueColCount = isPortfolio
    ? portfolioCriteriaMode
      ? portfolioCritColumns.length + matrixComponents.length // Kriterien + TL-Note
      : perLecturer
        ? components.length * (Math.max(lecturers.length, 0) + 1)
        : components.length
    : criteria.length;
  const emptyMsg = isPortfolio
    ? portfolioCriteriaMode
      ? "Kriterien pro Teilleistung unter Einstellungen festlegen."
      : "Noch keine Teilleistungen – unter Einstellungen festlegen (Standard: 2)."
    : "Noch keine Kriterien – unter Einstellungen anlegen.";

  const toggleGroupCriterion = (
    componentId: string,
    criterionId: string,
    disabled: boolean
  ) => {
    if (!selectedGroupId) return;
    setProject((prev) =>
      setGroupPortfolioCriterionDisabled(
        prev,
        selectedGroupId,
        componentId,
        criterionId,
        disabled
      )
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isPortfolio ? "Teilnoten (Portfolio)" : "Kriterienbewertung"}
          </h1>
          <p className="text-muted-foreground">
            {isPortfolio
              ? portfolioCriteriaMode
                ? perLecturer
                  ? "Kriterien je Teilleistung und Dozent; Teilnote = Mittel der Dozenten-Noten; Gesamtnote gewichtet. Pro Gruppe können Kriterien deaktiviert werden."
                  : "Kriterien je Teilleistung → berechnete Teilnote; Gesamtnote gewichtet. Pro Gruppe können einzelne Kriterien deaktiviert werden (zählen dann nicht)."
                : perLecturer
                  ? "Jeder Dozent vergibt Teilnoten; Teilnote = Mittel der Dozenten (gleichgewichtet). Gesamtnote = gewichteter Mittelwert der Teilleistungen (nächste deutsche Note)."
                  : "Teilnoten je Teilleistung eintragen. Gesamtnote = gewichteter Mittelwert, gerundet auf die nächste deutsche Note (1,0 … 5,0)."
              : "Werte je Kriterium eintragen (Skala pro Spalte: % / Note / Punkte). Gesamtwert und Note werden gewichtet berechnet (Notenschlüssel unter Szenarien). Hover auf ⓘ im Spaltenkopf für Details."}
          </p>
        </div>
        <Link
          href={`/exam/${id}/settings`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Settings className="size-4" />
          {isPortfolio ? "Teilleistungen / Gruppen" : "Kriterien / Gruppen"}
        </Link>
      </div>

      {isPortfolio && portfolioCriteriaMode ? (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gruppe wählen</CardTitle>
              <CardDescription>
                Nur Studierende der gewählten Gruppe in der Matrix – Farben
                zeigen den Füllstand
                {portfolioCriteriaMode
                  ? " der gewählten Teilleistung"
                  : " aller Teilleistungen"}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <GroupFilterBar
                project={project}
                rows={sortedRows}
                value={groupFilter}
                onChange={setGroupFilterSafe}
                groupFillStatus={groupFillStatus}
                showFillLegend
                fillScopeLabel={fillScopeLabel}
                onAfterNavigate={(delta) => {
                  if (delta === 1) scrollMatrix("right");
                  else scrollMatrix("left");
                }}
              />
            </CardContent>
          </Card>

          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Teilleistung
                {perLecturer ? " und Bewerter" : ""}
              </CardTitle>
              <CardDescription>
                Kriterien einer Teilleistung in der Matrix anzeigen
                {perLecturer
                  ? "; Dozent wechseln, um alle Bewertungen zu erfassen"
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {components.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Teilleistungen – bitte unter Einstellungen anlegen.
                </p>
              ) : (
                <div
                  className={cn(
                    "grid grid-cols-1 items-start gap-4",
                    perLecturer && "md:grid-cols-2"
                  )}
                >
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Teilleistung
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {components.map((c) => {
                        const active = c.id === activeComponentId;
                        const nCrit = c.criteria?.length ?? 0;
                        const nDis =
                          selectedGroupId != null
                            ? getGroupDisabledPortfolioCriteria(
                                project,
                                selectedGroupId,
                                c.id
                              ).length
                            : 0;
                        return (
                          <Button
                            key={c.id}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            className="h-auto min-h-9 flex-col items-start gap-0 px-3 py-1.5"
                            onClick={() => setComponentFilter(c.id)}
                          >
                            <span className="font-semibold">
                              {c.code || c.name}
                            </span>
                            <span
                              className={cn(
                                "text-[0.625rem] font-normal",
                                active
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {c.name !== c.code ? `${c.name} · ` : ""}
                              {nCrit} Krit.
                              {nDis > 0 ? ` · ${nDis} aus` : ""} · w{c.weight}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {perLecturer && (
                    <div className="min-w-0 space-y-2">
                      <Label
                        htmlFor="portfolio-lecturer-filter"
                        className="text-xs text-muted-foreground"
                      >
                        Dozent / Bewerter
                      </Label>
                      {lecturers.length === 0 ? (
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Keine Dozenten in den Stammdaten – bitte unter
                          Einstellungen eintragen.
                        </p>
                      ) : (
                        <Select
                          value={activeLecturer || lecturers[0]}
                          onValueChange={(v) => v && setLecturerFilter(v)}
                        >
                          <SelectTrigger
                            id="portfolio-lecturer-filter"
                            className="w-full"
                          >
                            <SelectValue>
                              {activeLecturer || lecturers[0]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {lecturers.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              )}
              {concreteGroupSelected && (
                <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <Label
                        htmlFor="group-performance"
                        className="text-sm font-medium"
                      >
                        Gruppenleistung
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Änderungen an Teilnote/Kriterien gelten für alle{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {groupMemberKeys.length}
                        </span>{" "}
                        Mitglieder
                        {selectedGroupName ? (
                          <>
                            {" "}
                            von{" "}
                            <span className="font-medium text-foreground">
                              {selectedGroupName}
                            </span>
                          </>
                        ) : (
                          " dieser Gruppe"
                        )}
                        .
                      </p>
                    </div>
                    <Switch
                      id="group-performance"
                      checked={groupPerformance}
                      onCheckedChange={setGroupPerformance}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={groupMemberKeys.length < 2}
                    onClick={() => copyActiveTlToGroup()}
                  >
                    Aktuelle TL-Werte auf Gruppe übernehmen
                  </Button>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    Quelle: zuerst ausgewählte Person, sonst erstes
                    Gruppenmitglied.
                  </p>
                </div>
              )}
              {selectedGroupId &&
                activeComponent &&
                activeTlCriteria.length > 0 && (
                  <div className="rounded-lg border border-dashed bg-background/60">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                      aria-expanded={criteriaDisableOpen}
                      onClick={() =>
                        setCriteriaDisableOpen((open) => !open)
                      }
                    >
                      {criteriaDisableOpen ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Kriterien für{" "}
                          <span className="text-primary">
                            {selectedGroupName ?? "Gruppe"}
                          </span>
                        </p>
                        {!criteriaDisableOpen && (
                          <p className="text-[0.6875rem] text-muted-foreground">
                            {groupDisabledCritIds.size > 0
                              ? `${groupDisabledCritIds.size} deaktiviert · zum Anpassen aufklappen`
                              : "alle aktiv · zum Deaktivieren aufklappen"}
                          </p>
                        )}
                      </div>
                    </button>
                    {criteriaDisableOpen && (
                      <div className="space-y-2 border-t px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">
                          Deaktivierte Kriterien fließen nur bei dieser Gruppe
                          nicht in die Note ein (keine Gruppenleistung). Andere
                          Gruppen bleiben unverändert.
                        </p>
                        <ul className="space-y-1.5">
                          {activeTlCriteria.map((k) => {
                            const off = groupDisabledCritIds.has(k.id);
                            const switchId = `crit-off-${activeComponent.id}-${k.id}`;
                            return (
                              <li
                                key={k.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5",
                                  off
                                    ? "border-muted bg-muted/40 opacity-80"
                                    : "bg-card"
                                )}
                              >
                                <Label
                                  htmlFor={switchId}
                                  className="min-w-0 cursor-pointer text-sm font-normal"
                                >
                                  <span
                                    className={cn(
                                      "font-medium",
                                      off &&
                                        "line-through text-muted-foreground"
                                    )}
                                  >
                                    {k.code || k.name}
                                  </span>
                                  {k.code && k.name !== k.code && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      {k.name}
                                    </span>
                                  )}
                                  <span className="ml-1.5 text-[0.625rem] text-muted-foreground tabular-nums">
                                    w{k.weight}
                                  </span>
                                </Label>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-[0.625rem] text-muted-foreground">
                                    {off ? "aus" : "an"}
                                  </span>
                                  <Switch
                                    id={switchId}
                                    checked={!off}
                                    onCheckedChange={(on) =>
                                      toggleGroupCriterion(
                                        activeComponent.id,
                                        k.id,
                                        !on
                                      )
                                    }
                                    aria-label={`${k.code || k.name} für Gruppe ${
                                      off ? "aktivieren" : "deaktivieren"
                                    }`}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              {selectedGroupId &&
                activeComponent &&
                activeTlCriteria.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Keine Kriterien für diese TL – unter Einstellungen anlegen.
                  </p>
                )}
              {!selectedGroupId && activeTlCriteria.length > 0 && (
                <p className="text-[0.6875rem] text-muted-foreground">
                  Gruppe wählen, um Kriterien nur für diese Gruppe zu
                  deaktivieren.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gruppe wählen</CardTitle>
            <CardDescription>
              {isPortfolio
                ? "Nur Studierende der gewählten Gruppe – Farben zeigen den Füllstand aller Teilleistungen."
                : "Nur Studierende der gewählten Gruppe in der Matrix – schnell wechseln mit den Schaltflächen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GroupFilterBar
              project={project}
              rows={sortedRows}
              value={groupFilter}
              onChange={setGroupFilterSafe}
              groupFillStatus={isPortfolio ? groupFillStatus : undefined}
              showFillLegend={isPortfolio}
              fillScopeLabel={isPortfolio ? fillScopeLabel : undefined}
              onAfterNavigate={(delta) => {
                if (delta === 1) scrollMatrix("right");
                else scrollMatrix("left");
              }}
            />
            {isPortfolio && concreteGroupSelected && (
              <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <Label
                      htmlFor="group-performance-simple"
                      className="text-sm font-medium"
                    >
                      Gruppenleistung
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Änderungen an Teilnoten gelten für alle{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {groupMemberKeys.length}
                      </span>{" "}
                      Mitglieder dieser Gruppe.
                    </p>
                  </div>
                  <Switch
                    id="group-performance-simple"
                    checked={groupPerformance}
                    onCheckedChange={setGroupPerformance}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={groupMemberKeys.length < 2}
                  onClick={() => copyActiveTlToGroup()}
                >
                  Aktuelle TL-Werte auf Gruppe übernehmen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {perLecturer && lecturers.length === 0 && (
        <Card className="surface-panel border-amber-400">
          <CardHeader>
            <CardTitle className="text-base">Keine Dozenten</CardTitle>
            <CardDescription>
              „Teilnoten je Dozent“ ist aktiv – bitte Dozenten unter
              Einstellungen eintragen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/exam/${id}/settings`} className={buttonVariants()}>
              Zu Einstellungen
            </Link>
          </CardContent>
        </Card>
      )}

      {cols.length === 0 ? (
        <Card className="surface-panel border-amber-400">
          <CardHeader>
            <CardTitle className="text-base">
              {isPortfolio ? "Keine Teilleistungen" : "Keine Kriterien"}
            </CardTitle>
            <CardDescription>{emptyMsg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/exam/${id}/settings`} className={buttonVariants()}>
              Zu Einstellungen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-panel overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Bewertungsmatrix</CardTitle>
                <CardDescription>
                  {isPortfolio
                    ? portfolioCriteriaMode
                      ? `${activeComponent?.code || activeComponent?.name || "TL"} · ${(activeComponent?.criteria ?? []).length} Krit.${
                          perLecturer && activeLecturer
                            ? ` · ${shortLecturerLabel(activeLecturer)}`
                            : ""
                        } · ${components.length} TL gesamt`
                      : perLecturer
                        ? `${components.length} Teilleistungen · ${lecturers.length} Dozent(en) · Gleichgewichtung`
                        : `${components.length} Teilleistungen · Gewichte relativ`
                    : `${criteria.length} Kriterien · Gewichte relativ · Max. Gesamtwert ${project.gradeSchema.maxPoints}`}
                  {" · "}
                  {filteredRows.length} von {sortedRows.length} Person(en)
                  {searchActive && (
                    <span className="text-foreground">
                      {" "}
                      · Suche über alle Gruppen
                    </span>
                  )}
                </CardDescription>
                {isCriteria && (
                  <p className="mt-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
                    Eingabe je Spalte:{" "}
                    <span className="text-foreground">0–100 %</span>
                    {" · "}
                    <span className="text-foreground">Note 1,0–5,0</span>
                    {" · "}
                    <span className="text-foreground">
                      Punkte 0…Max des Kriteriums
                    </span>
                    {" · "}Gewichte relativ · Hover auf{" "}
                    <CircleHelp className="inline size-3 align-text-bottom" />{" "}
                    für Skala und Bereich.
                  </p>
                )}
              </div>
              <div className="flex w-full min-w-[14rem] max-w-xs flex-col gap-2 sm:w-72">
                <label className="sr-only" htmlFor="assessment-name-search">
                  Name oder Matrikelnummer suchen
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <ClearableInput
                    id="assessment-name-search"
                    value={nameQuery}
                    onChange={setNameQuery}
                    placeholder="Suche Name / Matr.…"
                    className="h-9 pl-8"
                    autoComplete="off"
                    clearLabel="Suche löschen"
                  />
                </div>
                <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                  {hasGroups
                    ? "Gruppenübergreifend · mehrere Namen mit Komma · per Checkbox Sammelzuordnung."
                    : "Mehrere Namen mit Komma suchen."}
                </p>
                {noShowCount > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={showNoShows}
                      onCheckedChange={(v) => setShowNoShows(v === true)}
                    />
                    <span>
                      No-Shows anzeigen
                      <span className="ml-1 tabular-nums text-muted-foreground">
                        ({noShowCount})
                      </span>
                    </span>
                  </label>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  title="Matrix nach links scrollen"
                  onClick={() => scrollMatrix("left")}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  title="Matrix nach rechts scrollen"
                  onClick={() => scrollMatrix("right")}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            {hasGroups && selectedKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Users className="size-4 shrink-0 text-primary" />
                <span className="text-sm font-medium tabular-nums">
                  {selectedKeys.length} ausgewählt
                </span>
                <span className="text-xs text-muted-foreground">
                  Gruppe zuweisen:
                </span>
                <StudentGroupSelect
                  project={project}
                  groupId={null}
                  rows={sortedRows}
                  className="min-w-[10rem]"
                  compact
                  onChange={(gid) => assignSelectedToGroup(gid)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedKeys([])}
                >
                  Auswahl aufheben
                </Button>
              </div>
            )}
            {hasGroups && unassignedTotal > 0 && selectedKeys.length === 0 && (
              <p className="mt-2 text-[0.6875rem] text-amber-900 dark:text-amber-100">
                {unassignedTotal} Person(en) ohne Gruppe – markiert in der
                Matrix; Checkboxen für Sammelzuordnung nutzen.
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={matrixScrollRef}
              className="max-h-[min(70vh,720px)] overflow-auto"
            >
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    {hasGroups && (
                      <TableHead className="w-10 px-2">
                        <Checkbox
                          checked={allVisibleSelected}
                          indeterminate={someVisibleSelected}
                          onCheckedChange={(v) =>
                            toggleAllVisible(v === true)
                          }
                          aria-label="Alle sichtbaren Personen auswählen"
                          disabled={visibleKeys.length === 0}
                        />
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "sticky z-20 min-w-[140px] bg-card",
                        hasGroups ? "left-10" : "left-0"
                      )}
                    >
                      Name
                    </TableHead>
                    <TableHead className="min-w-[88px]">Matr.</TableHead>
                    {hasGroups && (
                      <TableHead className="min-w-[7.5rem]">Gruppe</TableHead>
                    )}
                    {isPortfolio
                      ? portfolioCriteriaMode
                        ? [
                            ...portfolioCritColumns.map((col) => {
                              const headerDisabled =
                                selectedGroupId != null &&
                                groupDisabledCritIds.has(col.criterion.id);
                              const detailTip = criterionDetailTooltip(
                                col.criterion
                              );
                              const headerTitle = headerDisabled
                                ? `${col.componentCode} · ${col.criterion.name} · für diese Gruppe deaktiviert`
                                : detailTip;
                              return (
                              <TableHead
                                key={`${col.componentId}::${col.criterion.id}`}
                                className={cn(
                                  "min-w-[7rem] text-center",
                                  headerDisabled && "opacity-50"
                                )}
                                title={headerTitle}
                              >
                                <div className="flex items-start justify-center gap-0.5">
                                  <div className="min-w-0">
                                    <div className="text-[0.625rem] font-normal text-muted-foreground">
                                      {col.componentCode}
                                      {activeLecturer
                                        ? ` · ${shortLecturerLabel(activeLecturer)}`
                                        : ""}
                                    </div>
                                    <div
                                      className={cn(
                                        "font-semibold text-[0.6875rem] leading-tight",
                                        headerDisabled && "line-through"
                                      )}
                                    >
                                      {col.criterion.code ||
                                        col.criterion.name}
                                    </div>
                                    <div className="text-[0.625rem] text-muted-foreground">
                                      {headerDisabled
                                        ? "deaktiviert"
                                        : `${criterionScaleShort(col.criterion)} · w${col.criterion.weight}`}
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger
                                      type="button"
                                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                      aria-label={`Beschreibung: ${col.criterion.name || col.criterion.code}`}
                                    >
                                      <CircleHelp className="size-3.5" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="bottom"
                                      className="max-w-[18rem] whitespace-pre-wrap text-left leading-snug"
                                    >
                                      {headerDisabled
                                        ? `${col.criterion.name || col.criterion.code}\n\nFür diese Gruppe deaktiviert – zählt nicht zur Note.`
                                        : detailTip}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableHead>
                              );
                            }),
                            ...matrixComponents.map((c) => (
                              <TableHead
                                key={`${c.id}::note`}
                                className="min-w-[64px] text-center bg-muted/30"
                                title={`Berechnete Teilnote ${c.name}`}
                              >
                                <div className="font-semibold text-[0.6875rem]">
                                  {c.code || c.name}
                                </div>
                                <div className="text-[0.625rem] font-normal text-muted-foreground">
                                  Note · w{c.weight}
                                </div>
                              </TableHead>
                            )),
                          ]
                        : perLecturer
                          ? components.flatMap((c) => [
                              ...lecturers.map((lec) => (
                                <TableHead
                                  key={`${c.id}::${lec}`}
                                  className="min-w-[88px] text-center"
                                  title={`${c.name} · ${lec} · Gewicht ${c.weight}`}
                                >
                                  <div className="font-semibold text-[0.6875rem] leading-tight">
                                    {c.code || c.name}
                                  </div>
                                  <div className="text-[0.625rem] font-normal text-muted-foreground">
                                    {shortLecturerLabel(lec)}
                                  </div>
                                </TableHead>
                              )),
                              <TableHead
                                key={`${c.id}::avg`}
                                className="min-w-[64px] text-center bg-muted/30"
                                title={`Mittel ${c.name} (Dozenten gleichgewichtet)`}
                              >
                                <div className="font-semibold text-[0.6875rem]">
                                  {c.code || c.name}
                                </div>
                                <div className="text-[0.625rem] font-normal text-muted-foreground">
                                  Ø · w{c.weight}
                                </div>
                              </TableHead>,
                            ])
                          : components.map((c) => (
                              <TableHead
                                key={c.id}
                                className="min-w-[100px] text-center"
                                title={`${c.name} · Gewicht ${c.weight}`}
                              >
                                <div className="font-semibold">
                                  {c.code || c.name}
                                </div>
                                <div className="text-[0.625rem] font-normal text-muted-foreground">
                                  Note · w{c.weight}
                                </div>
                              </TableHead>
                            ))
                      : criteria.map((c) => (
                          <TableHead
                            key={c.id}
                            className="min-w-[7.5rem] text-center"
                          >
                            <div className="flex items-start justify-center gap-0.5">
                              <div className="min-w-0">
                                <div
                                  className="font-semibold leading-tight"
                                  title={c.name}
                                >
                                  {c.code || c.name}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className="h-5 max-w-full px-1.5 text-[0.625rem] font-semibold whitespace-normal"
                                  >
                                    {criterionScaleShort(c)}
                                  </Badge>
                                  <span className="text-[0.625rem] font-normal text-muted-foreground tabular-nums">
                                    w{c.weight}
                                  </span>
                                </div>
                              </div>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label={`Eingabehilfe: ${c.name || c.code}`}
                                >
                                  <CircleHelp className="size-3.5" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-[18rem] whitespace-pre-wrap text-left leading-snug"
                                >
                                  {criterionDetailTooltip(c)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                        ))}
                    {isCriteria && (
                      <TableHead className="min-w-[72px] text-center bg-muted/40">
                        Gesamt
                      </TableHead>
                    )}
                    {isPortfolio && (
                      <TableHead className="min-w-[72px] text-center bg-muted/40">
                        Mittel
                      </TableHead>
                    )}
                    <TableHead className="min-w-[64px] text-center bg-muted/50">
                      Note
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          (hasGroups ? 2 : 0) + // Auswahl + Gruppe
                          2 + // Name + Matr.
                          valueColCount +
                          (isCriteria ? 1 : 0) +
                          (isPortfolio ? 1 : 0) +
                          1 // Note
                        }
                        className="h-20 text-center text-muted-foreground"
                      >
                        {sortedRows.length === 0
                          ? "Noch keine Personen – bitte HISinOne importieren oder manuell hinzufügen."
                          : searchActive
                            ? "Keine Person passt zur Suche."
                            : !showNoShows && noShowCount > 0
                              ? "Keine sichtbaren Personen (No-Shows sind ausgeblendet)."
                              : "Keine Personen in dieser Gruppe."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const rec = project.points.find(
                        (p) =>
                          normalizeMatriculation(p.matriculationNumber) ===
                          r.key
                      );
                      const rowGroupId = r.student.groupId ?? null;
                      const rowDisabledCrit = isPortfolio
                        ? new Set(
                            disabledCriteriaForGroup(
                              project,
                              rowGroupId,
                              activeComponentId
                            )
                          )
                        : new Set<string>();
                      const gradeCtx = {
                        groupId: rowGroupId,
                        schema: project.gradeSchema,
                      };
                      const effGrades = isPortfolio
                        ? effectivePortfolioGrades(project, rec, gradeCtx)
                        : null;
                      const rawAvg = isPortfolio
                        ? computePortfolioRawAverageForProject(
                            project,
                            rec,
                            gradeCtx
                          )
                        : null;
                      const ungrouped =
                        hasGroups && !r.student.groupId;
                      const selected = selectedKeys.includes(r.key);
                      const rowBg = ungrouped
                        ? "bg-amber-50/90 dark:bg-amber-950/35"
                        : selected
                          ? "bg-primary/5"
                          : undefined;
                      const stickyBg = ungrouped
                        ? "bg-amber-50 dark:bg-amber-950/50"
                        : selected
                          ? "bg-primary/5"
                          : "bg-card";

                      const isHighlight = highlightMat === r.key;

                      return (
                        <TableRow
                          key={r.key}
                          data-mat-row={r.key}
                          className={cn(
                            rowBg,
                            ungrouped && "border-l-2 border-l-amber-500",
                            isHighlight &&
                              "ring-2 ring-primary ring-inset bg-primary/10"
                          )}
                        >
                          {hasGroups && (
                            <TableCell className={cn("w-10 px-2", rowBg)}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(v) =>
                                  toggleKey(r.key, v === true)
                                }
                                aria-label={`${r.student.lastName}, ${r.student.firstName} auswählen`}
                              />
                            </TableCell>
                          )}
                          <TableCell
                            className={cn(
                              "sticky z-10 font-medium whitespace-nowrap",
                              hasGroups ? "left-10" : "left-0",
                              stickyBg
                            )}
                          >
                            <div className="flex flex-col items-start gap-1">
                              <span>
                                {r.student.lastName}, {r.student.firstName}
                                {ungrouped && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 border-amber-500/60 bg-amber-100/80 text-[0.625rem] text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                                  >
                                    ohne Gruppe
                                  </Badge>
                                )}
                                {!r.inHis && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 text-[0.625rem]"
                                  >
                                    manuell
                                  </Badge>
                                )}
                                {r.status === "no_show" && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 border-orange-400/70 bg-orange-50 text-[0.625rem] text-orange-950 dark:bg-orange-950/50 dark:text-orange-100"
                                  >
                                    nicht angetreten
                                  </Badge>
                                )}
                              </span>
                              {(() => {
                                const isNoShow = r.status === "no_show";
                                const hasGroup = Boolean(r.student.groupId);
                                const hasValues = personHasAssessmentValues(
                                  project,
                                  rec
                                );
                                // Mit Gruppe + eingetragenen Werten ausblenden;
                                // No-Show immer anzeigen (Aufheben).
                                const showToggle =
                                  r.inHis &&
                                  (isNoShow || !hasGroup || !hasValues);
                                if (!showToggle) return null;
                                return (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isNoShow ? "default" : "outline"}
                                    className={cn(
                                      "h-7 gap-1 px-2 text-xs font-semibold shadow-sm",
                                      isNoShow
                                        ? "bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500"
                                        : "border-2 border-orange-500 bg-orange-50 text-orange-950 hover:bg-orange-100 dark:border-orange-400 dark:bg-orange-950/50 dark:text-orange-50 dark:hover:bg-orange-950"
                                    )}
                                    title={
                                      isNoShow
                                        ? "Wieder bewerten (Teilnoten erforderlich)"
                                        : "Keine Teilnoten – Workflow/Export freigeben (No-Show)"
                                    }
                                    onClick={() =>
                                      setProject((prev) =>
                                        setStudentNotAttended(
                                          prev,
                                          r.key,
                                          !isNoShow
                                        )
                                      )
                                    }
                                  >
                                    {isNoShow ? (
                                      <UserCheck className="size-3.5 shrink-0" />
                                    ) : (
                                      <UserX className="size-3.5 shrink-0" />
                                    )}
                                    {isNoShow
                                      ? "Antritt markieren"
                                      : "Nicht angetreten"}
                                  </Button>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", rowBg)}>
                            {r.key}
                          </TableCell>
                          {hasGroups && (
                            <TableCell className={cn("p-1", rowBg)}>
                              <StudentGroupSelect
                                project={project}
                                groupId={r.student.groupId}
                                rows={sortedRows}
                                compact
                                highlightEmpty
                                onChange={(gid) =>
                                  setProject((prev) =>
                                    setStudentGroupId(prev, r.key, gid)
                                  )
                                }
                              />
                            </TableCell>
                          )}
                          {isPortfolio
                            ? portfolioCriteriaMode
                              ? [
                                  ...portfolioCritColumns.map((col) => {
                                    const critDisabled = rowDisabledCrit.has(
                                      col.criterion.id
                                    );
                                    const v = activeLecturer
                                      ? rec
                                          ?.portfolioCriterionValuesByLecturer?.[
                                          col.componentId
                                        ]?.[activeLecturer]?.[
                                          col.criterion.id
                                        ]
                                      : rec?.portfolioCriterionValues?.[
                                          col.componentId
                                        ]?.[col.criterion.id];
                                    return (
                                      <TableCell
                                        key={`${col.componentId}::${col.criterion.id}`}
                                        className={cn(
                                          "p-1 text-center",
                                          rowBg,
                                          critDisabled && "opacity-50"
                                        )}
                                      >
                                        {critDisabled ? (
                                          <span
                                            className="mx-auto inline-flex h-8 w-[4.5rem] items-center justify-center rounded-md border border-dashed text-[0.625rem] text-muted-foreground"
                                            title="Kriterium für die Gruppe dieser Person deaktiviert – zählt nicht zur Note"
                                          >
                                            aus
                                          </span>
                                        ) : (
                                          <Input
                                            className="mx-auto h-8 w-[4.5rem] text-center text-sm"
                                            defaultValue={
                                              v != null
                                                ? String(v).replace(".", ",")
                                                : ""
                                            }
                                            key={`${r.key}-${col.componentId}-${col.criterion.id}-${activeLecturer || "all"}`}
                                            placeholder={criterionPlaceholder(
                                              col.criterion
                                            )}
                                            title={criterionDetailTooltip(
                                              col.criterion
                                            )}
                                            inputMode="decimal"
                                            data-matrix-input
                                            onKeyDown={handleMatrixInputKeyDown}
                                            onBlur={(e) =>
                                              setPortfolioCriterionValue(
                                                r.key,
                                                col.componentId,
                                                col.criterion.id,
                                                e.target.value,
                                                activeLecturer || null
                                              )
                                            }
                                          />
                                        )}
                                      </TableCell>
                                    );
                                  }),
                                  ...matrixComponents.map((c) => {
                                    const disabledIds =
                                      disabledCriteriaForGroup(
                                        project,
                                        rowGroupId,
                                        c.id
                                      );
                                    const scale =
                                      resolveComponentCriteriaScale(c);
                                    const unit = activeLecturer
                                      ? unitAvgFromCriterionValues(
                                          rec
                                            ?.portfolioCriterionValuesByLecturer?.[
                                            c.id
                                          ]?.[activeLecturer],
                                          (c.criteria ?? []).map((k) => ({
                                            ...k,
                                            scale,
                                          })),
                                          {
                                            disabledCriterionIds: disabledIds,
                                          }
                                        )
                                      : unitAvgForPortfolioComponent(
                                          project,
                                          rec,
                                          c,
                                          rowGroupId
                                        );
                                    const note =
                                      unit == null
                                        ? null
                                        : gradeFromUnitAvg(
                                            unit,
                                            scale,
                                            project.gradeSchema
                                          );
                                    // Rohpunkte-Summe für Anzeige (Punkte-Skala)
                                    let ptsLabel = "";
                                    if (
                                      unit != null &&
                                      (scale === "points" ||
                                        scale === "percent")
                                    ) {
                                      const pctLabel = `${(unit * 100).toFixed(0)}\u00a0%`;
                                      const crits = (c.criteria ?? []).map(
                                        (k) => ({ ...k, scale })
                                      );
                                      const vals = activeLecturer
                                        ? rec
                                            ?.portfolioCriterionValuesByLecturer?.[
                                            c.id
                                          ]?.[activeLecturer]
                                        : rec?.portfolioCriterionValues?.[
                                            c.id
                                          ];
                                      const tot = criterionPointsTotals(vals, crits, {
                                        disabledCriterionIds: disabledIds,
                                      });
                                      if (tot && tot.max > 0) {
                                        // formatPoints vermeidet Gleitkomma-Müll (z. B. 19.599999…)
                                        ptsLabel = `${formatPoints(tot.raw)}/${formatPoints(tot.max)} · ${pctLabel}`;
                                      } else {
                                        ptsLabel = pctLabel;
                                      }
                                    }
                                    const tlNext = tlNextFromUnit(
                                      unit,
                                      scale,
                                      project.gradeSchema
                                    );
                                    const nextWorse =
                                      tlNext?.direction === "worse";
                                    return (
                                      <TableCell
                                        key={`${c.id}::note`}
                                        className={cn(
                                          "text-center tabular-nums text-sm font-medium bg-muted/25",
                                          rowBg
                                        )}
                                      >
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span>{formatGrade(note)}</span>
                                          {ptsLabel ? (
                                            <span className="text-[0.625rem] font-normal text-muted-foreground">
                                              {ptsLabel}
                                            </span>
                                          ) : null}
                                          {tlNext ? (
                                            <span
                                              className={cn(
                                                "inline-flex w-fit max-w-full items-center rounded border px-1 py-px text-[0.5625rem] font-semibold tabular-nums",
                                                nextWorse
                                                  ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-50"
                                                  : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50"
                                              )}
                                              title={
                                                nextWorse
                                                  ? `Abstand zur nächstschlechteren TL-Note`
                                                  : `Abstand zur nächstbesseren TL-Note`
                                              }
                                            >
                                              {nextWorse ? "↓" : "↑"}
                                              {formatPoints(
                                                tlNext.pointsToNext,
                                                1
                                              )}
                                              →
                                              {formatGrade(tlNext.nextGrade)}
                                            </span>
                                          ) : null}
                                        </div>
                                      </TableCell>
                                    );
                                  }),
                                ]
                              : perLecturer
                                ? components.flatMap((c) => [
                                    ...lecturers.map((lec) => {
                                      const v =
                                        rec?.portfolioGradesByLecturer?.[
                                          c.id
                                        ]?.[lec];
                                      return (
                                        <TableCell
                                          key={`${c.id}::${lec}`}
                                          className={cn(
                                            "p-1 text-center",
                                            rowBg
                                          )}
                                        >
                                          <Input
                                            className="mx-auto h-8 w-[4.25rem] text-center text-sm"
                                            defaultValue={
                                              v != null
                                                ? String(v).replace(".", ",")
                                                : ""
                                            }
                                            key={`${r.key}-${c.id}-${lec}`}
                                            placeholder="–"
                                            title={`${c.name} · ${lec}`}
                                            data-matrix-input
                                            onKeyDown={handleMatrixInputKeyDown}
                                            onBlur={(e) =>
                                              setPortfolioLecturerGrade(
                                                r.key,
                                                c.id,
                                                lec,
                                                e.target.value
                                              )
                                            }
                                          />
                                        </TableCell>
                                      );
                                    }),
                                    <TableCell
                                      key={`${c.id}::avg`}
                                      className={cn(
                                        "text-center tabular-nums text-sm bg-muted/25",
                                        ungrouped &&
                                          "bg-amber-100/40 dark:bg-amber-950/20"
                                      )}
                                    >
                                      {(() => {
                                        const avgG =
                                          averageLecturerGradesForComponent(
                                            rec?.portfolioGradesByLecturer,
                                            c.id,
                                            lecturers
                                          );
                                        const unit =
                                          avgG != null
                                            ? (5 - avgG) / 4
                                            : null;
                                        const tlNext = tlNextFromUnit(
                                          unit,
                                          "grade",
                                          null
                                        );
                                        const nextWorse =
                                          tlNext?.direction === "worse";
                                        return (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span>{formatGrade(avgG)}</span>
                                            {tlNext ? (
                                              <span
                                                className={cn(
                                                  "inline-flex w-fit items-center rounded border px-1 py-px text-[0.5625rem] font-semibold tabular-nums",
                                                  nextWorse
                                                    ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-50"
                                                    : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50"
                                                )}
                                              >
                                                {nextWorse ? "↓" : "↑"}
                                                {formatPoints(
                                                  tlNext.pointsToNext,
                                                  1
                                                )}
                                                →
                                                {formatGrade(tlNext.nextGrade)}
                                              </span>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </TableCell>,
                                  ])
                                : components.map((c) => {
                                    const v =
                                      rec?.portfolioGrades?.[c.id] ??
                                      effGrades?.[c.id];
                                    return (
                                      <TableCell
                                        key={c.id}
                                        className={cn(
                                          "p-1 text-center",
                                          rowBg
                                        )}
                                      >
                                        <Input
                                          className="mx-auto h-8 w-[4.5rem] text-center text-sm"
                                          defaultValue={
                                            v != null
                                              ? String(v).replace(".", ",")
                                              : ""
                                          }
                                          key={`${r.key}-${c.id}`}
                                          placeholder="–"
                                          data-matrix-input
                                          onKeyDown={handleMatrixInputKeyDown}
                                          onBlur={(e) =>
                                            setPortfolioGrade(
                                              r.key,
                                              c.id,
                                              e.target.value
                                            )
                                          }
                                        />
                                      </TableCell>
                                    );
                                  })
                            : criteria.map((c) => {
                                const v = rec?.criterionValues?.[c.id];
                                const hint = criterionDetailTooltip(c);
                                return (
                                  <TableCell
                                    key={c.id}
                                    className={cn("p-1 text-center", rowBg)}
                                  >
                                    <Input
                                      className="mx-auto h-8 w-[5rem] text-center text-sm"
                                      defaultValue={
                                        v != null
                                          ? String(v).replace(".", ",")
                                          : ""
                                      }
                                      key={`${r.key}-${c.id}`}
                                      placeholder={criterionPlaceholder(c)}
                                      title={hint}
                                      aria-label={`${c.name || c.code}: ${criterionScaleShort(c)}`}
                                      inputMode="decimal"
                                      data-matrix-input
                                      onKeyDown={handleMatrixInputKeyDown}
                                      onBlur={(e) =>
                                        setCriterionValue(
                                          r.key,
                                          c.id,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </TableCell>
                                );
                              })}
                          {isCriteria && (
                            <TableCell
                              className={cn(
                                "text-center tabular-nums text-sm bg-muted/20",
                                ungrouped && "bg-amber-100/40 dark:bg-amber-950/20"
                              )}
                            >
                              {formatPoints(r.totalPoints)}
                            </TableCell>
                          )}
                          {isPortfolio && (
                            <TableCell
                              className={cn(
                                "text-center tabular-nums text-sm bg-muted/20",
                                ungrouped && "bg-amber-100/40 dark:bg-amber-950/20"
                              )}
                            >
                              {rawAvg != null
                                ? formatGrade(rawAvg)
                                : "–"}
                            </TableCell>
                          )}
                          <TableCell
                            className={cn(
                              "text-center tabular-nums font-semibold bg-muted/30",
                              ungrouped && "bg-amber-100/50 dark:bg-amber-950/25"
                            )}
                          >
                            {formatGrade(r.finalGrade)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
