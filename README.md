# ExamGrade – Prüfungsnoten-Tool

Client-seitige Webanwendung zur effizienten Notenvergabe und Dokumentation von Prüfungen (Take-Home-Exams, Klausuren). Ablösung des Excel-Workflows (HIS → Antritt → Punkte → Note → QIS-Upload).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- exceljs, TanStack Table, Recharts
- localforage (IndexedDB) – kein Backend
- Deutsch, Light-Design (ThesisEval-Optik)

## Lokal starten

```bash
npm install
npm run dev
```

Öffnen: [http://localhost:3000](http://localhost:3000)

## Workflow

1. **Neue Prüfung** anlegen (Name, P.-Nr., Teilgebiete, max. Punkte, Bestehensgrenze)
2. **HIS/QIS-Noteneintragsdatei** importieren (Masterliste)
3. **Antrittsliste** (Moodle) importieren
4. **Punkte** importieren (Moodle-THE) oder manuell erfassen
5. Noten prüfen, bei Bedarf Override mit Kommentar
6. **HIS-Excel exportieren** und in QIS hochladen
7. Optional: JSON-Backup speichern

## Daten

Alles bleibt im Browser (IndexedDB). JSON-Export/Import für Backup und Austausch.

Die Beispieldatei `2026-07_FRM-Notengebung_THE.xlsx` im Repo-Root dient als Workflow-Referenz (Blätter Definitionen, Antritt, Punkte, Noteneintrag, Durchfaller).

## Build / Deploy

```bash
npm run build
npm start
```

Deploy auf Vercel: Repository verbinden, Framework Next.js.

### App-Passwort

Die App ist client-seitig passwortgeschützt (sessionStorage, gilt pro Browser-Tab).

| Variable | Bedeutung |
|----------|-----------|
| `NEXT_PUBLIC_APP_PASSWORD` | Zugangspasswort (Build-Zeit) |

- **Lokal:** `.env.local` anlegen (Vorlage: `.env.example`), dann `npm run dev` neu starten.
- **Vercel:** Settings → Environment Variables → `NEXT_PUBLIC_APP_PASSWORD` setzen und neu deployen.
- **Fallback** (nur wenn Env fehlt): `oth-regensburg` – in Produktion bitte überschreiben.

Hinweis: Das Passwort liegt im Client-Bundle und ist **kein** serverseitiger Geheimnisschutz.
