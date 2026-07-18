# Architektur ExamGrade

Technische Übersicht für Entwicklung und Review.

---

## 1. Überblick

```
┌─────────────────────────────────────────────┐
│  Browser (Next.js Client Components)        │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
│  │ UI / UX  │  │ Domain Lib │  │ IndexedDB│  │
│  │ pages    │→ │ excel/pdf  │→ │ localforage│ │
│  │ components│ │ grades/... │  │           │  │
│  └──────────┘  └────────────┘  └─────────┘  │
└─────────────────────────────────────────────┘
         │
         │ nur statische Assets + SSR-Shell
         ▼
   Hosting (z. B. Vercel) – keine App-API für Noten
```

| Eigenschaft | Umsetzung |
|-------------|-----------|
| Framework | Next.js 15 App Router |
| Rendering | Überwiegend Client Components; Root-Layout mit Auth-Gate |
| API-Routen | **Keine** (`src/app/api` existiert nicht) |
| Persistenz | **IndexedDB** via localforage |
| Auth | Client-Passwort + `sessionStorage` (Zugangshürde) |
| Sprache | TypeScript, UI deutsch |

---

## 2. Verzeichnisstruktur (relevant)

```
src/
  app/                    # Routen
    page.tsx              # Prüfungsliste
    exam/[id]/           # Prüfungskontext
      overview/
      import/
      matching/
      points/ detail-points/
      scenarios/ grades/
      documents/ export/
      settings/
  components/             # UI (auth, exam, grades, import, layout, pdf-bezogen, …)
  hooks/                  # useExam, useExams, useAutoSave
  lib/                    # Domänenlogik
    excel/                # Parse/Export XLSX
    grades/               # Schema, Szenarien, Statistik, open-grading
    matching/             # Identity merge/dismiss
    pdf/                  # jspdf-Exporte
    storage.ts            # IndexedDB
    project-archive.ts    # JSON-Sicherung
    workflow-steps.ts     # Sidebar/Übersicht
    app-auth.ts           # Passwort-Gate
    import-limits.ts      # Größenlimits
```

---

## 3. Routing

| Route | Zweck |
|-------|--------|
| `/` | Prüfungsliste, JSON-Import/Export der Sicherung |
| `/exam/[id]/` | Redirect/Einstieg in die Prüfung |
| `/exam/[id]/overview` | Übersicht + Workflow |
| `/exam/[id]/import` | HISinOne, Antritt, Punkte |
| `/exam/[id]/matching` | Matrikel-Zuordnung |
| `/exam/[id]/points` | Punkte-Matrix |
| `/exam/[id]/detail-points` | Aufgabenbewertung |
| `/exam/[id]/scenarios` | Notenszenarien |
| `/exam/[id]/grades` | Notentabelle |
| `/exam/[id]/documents` | Dokumenten-Center |
| `/exam/[id]/export` | Export & Sicherung |
| `/exam/[id]/settings` | Prüfungseinstellungen |

Layout: `exam-client-layout` mit Sidebar (Workflow sticky) und Exam-Context.

---

## 4. Datenmodell

Kernobjekt: **`ExamProject`** (`src/lib/types.ts`).

Wichtige Felder (vereinfacht):

- Identität: `id`, `name`, `examNumber`, `semester`, `examType`, `schemaVersion`  
- HISinOne: `hisSources[]` (inkl. `originalXlsxBase64`), abgeleitet `hisRows`  
- `attendance[]`, `points[]`, `students{}`, `questionDefs[]`  
- Noten: `gradeSchema`, `gradeScenarios[]`, `activeScenarioId`  
- Audit Matching: `identityMerges[]`, `identityDismissals[]`  
- Workflow: `workflowMilestones`, `lastBackupAt`, `importLogs[]`  

Migrationen: `migrateExamProject` in `lib/grades/scenarios.ts` (Schema-Versionen 1→2→3).

**JSON-Archiv:** Wrapper `format: "examgrade-project"` (`project-archive.ts`), Legacy: reines Project-JSON.

---

## 5. Wichtige Module

| Modul | Verantwortung |
|-------|----------------|
| `lib/excel/parse-his.ts` | HISinOne-/Legacy-Listen |
| `lib/excel/parse-attendance.ts` | Moodle-Antritt |
| `lib/excel/parse-moodle-points.ts` | Punkte/Aufgaben |
| `lib/excel/export-his.ts` | Formatgetreuer Re-Export |
| `lib/grades/*` | Schwellen, Szenarien, Totals, Open Grading, Notenspiegel |
| `lib/matching/*` | Orphans, Merge, Dismiss, Undo |
| `lib/pdf/*` | PDF-Generierung |
| `lib/validations.ts` | Export-Gates (fachlich) |
| `lib/download.ts` | Blob-Downloads inkl. Teams-Fallback |
| `lib/workflow-steps.ts` | UI-Workflow-Status |

---

## 6. Persistenz und Auto-Save

- `lib/storage.ts`: Stores für Exams und Drafts.  
- Hooks laden/speichern Projekte; Änderungen aktualisieren `updatedAt`.  
- Backup-Stale: Vergleich `updatedAt` vs. `lastBackupSyncedUpdatedAt`.  

Keine serverseitige Replikation.

---

## 7. Auth und Security (kurz)

- Passwort: `NEXT_PUBLIC_APP_PASSWORD` (Build-Zeit).  
- Production/Vercel-Build **ohne** Variable → Fehler in `next.config.ts`.  
- Session: `sessionStorage` Key `exam-grade-auth`.  
- Headers: CSP light, nosniff, referrer (kein Frame-Deny wegen Teams).  
- Import-Limits: 50 MB JSON, 15 MB Excel.  

Details: [SECURITY.md](../SECURITY.md).

---

## 8. UI und Design

- Tailwind 4, shadcn-Komponenten unter `components/ui`.  
- Theme: `ThemeProvider` + FOUC-Script im Root-Layout (`localStorage` Appearance).  
- Charts: Recharts + Canvas-Export für Notenspiegel.  

---

## 9. Versionierung

| Ort | Inhalt |
|-----|--------|
| `package.json` → `version` | npm-Version |
| `src/lib/app-version.ts` | Anzeige Footer / Labels (`APP_VERSION`) |

Bei Releases beide Stellen abstimmen.

---

## 10. Entwicklungshinweise

```bash
npm install
cp .env.example .env.local   # Passwort setzen
npm run dev
npm run lint
npx tsc --noEmit
npm run build                # benötigt Passwort in Env
```

- Keine Secrets außer dem öffentlichen Client-Passwort in `NEXT_PUBLIC_*`.  
- Fachlogik bevorzugt in `lib/`, nicht in Page-Komponenten.  
- Neue HTML-Sinks mit User-Daten vermeiden (React-Text escapen).  

### Versionierung bei Commits

Bei **jedem** Release-Commit die Version **synchron** erhöhen in:

1. `package.json` → `"version"`
2. `src/lib/app-version.ts` → `APP_VERSION`
3. ggf. Erwähnungen in `README.md` (Footer)

SemVer: Patch (`0.1.x`) für Fixes/Docs, Minor (`0.x.0`) für Features, Major bei Breaking Changes.  

