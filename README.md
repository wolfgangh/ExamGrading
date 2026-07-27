# ExamGrade

**Client-seitiges Prüfungsnoten-Tool** für deutsche Hochschulen – von der HISinOne-Masterliste über Antritt und Punkte bis zum formatgetreuen Notenexport und prüferinternen Szenarienvergleich.

© Prof. Dr. Wolfgang Hößl · OTH Regensburg · *Client-seitig · Keine Serverübertragung*

**Aktuelle Version:** 0.4.44 (siehe auch `package.json` und App-Footer)

**Noten-Regression:** `npm run test:grades` führt `scripts/grade-constellation-matrix.mts` aus (Konstellationen A–E, Szenarien, Grenzfälle). Workflow: `.grok/workflows/test-grade-constellations.rhai`.

---

## Was ist ExamGrade?

ExamGrade ersetzt den klassischen Excel-Workflow (HISinOne → Antritt → Punkte → Note → Upload) durch eine geführte Web-Oberfläche im Browser. Alle Prüfungsdaten bleiben **lokal** (IndexedDB); es gibt **keine App-API** und **keine Übertragung von Noten an einen Server**.

Geeignet u. a. für:

- **Take-Home-Exams (THE)** und **elektronische Prüfungen (elektrP)** mit Moodle-Antritt und -Punkten  
- **Klausuren** mit Punktevorlage und Notenschlüssel  
- **Studienarbeiten (StA)** – Kriterienmatrix oder manuelle Note  
- **Portfolioprüfungen** – Teilnoten (optional je Dozent) und gewichtete Gesamtnote  
- Mehrere HISinOne-Quellen (Studiengänge) in einer Prüfung  
- **Studentengruppen** (StA / Portfolio) mit Filter und Sammelzuordnung  

---

## Funktionen

| Bereich | Inhalt |
|--------|--------|
| **Prüfungstypen** | THE, elektrP, Klausur, StA (Kriterien / manuell), Portfolio (optional Teilnoten je Dozent), Sonstige |
| **Startseite** | Prüfungskarten mit Semester, Prüfungsform, Workflow-Status; Multi-JSON- und **Semester-ZIP**-Import/Export |
| **Import** | HISinOne (auch mehrere Dateien), Moodle-Antritt, Moodle-/Punkte-Excel; manuell Personen (StA/Portfolio) |
| **Zuordnung** | Matrikel-Tippfehler: Vorschläge, zusammenführen, ablehnen, rückgängig |
| **Bewertung** | Detailpunkte, offene Aufgaben; **Bewertungsmatrix** (StA-Kriterien / Portfolio-Teilnoten) mit Skalenhinweisen, Gruppen, Namenssuche |
| **Noten** | Szenarien (Bestehensgrenzen), Overrides, Notenspiegel, Szenario-Impact |
| **Szenarien-Vergleich** | KPIs, Notenstufen + Einzelnoten (Tabelle \| Chart), Durchfaller über Szenarien, **PDF-Export** zum Prüferaustausch |
| **Diagramme** | Klick zum Vergrößern; **PNG** inkl. Titel/Beschriftung |
| **Export** | HISinOne-XLSX, Notenliste / Änderungen / Manuell / Durchfaller (PDF), Notenspiegel PDF/Excel, Szenarien-PDF, JSON-Sicherung |
| **Workflow** | Fortschritt, Meilensteine (u. a. Sicherung nach Import / nach Noten); JSON-Dateiname mit **Datum + Schritt** (ohne Uhrzeit) |
| **Teams** | Website-Tab; robuste Downloads (File-Picker / manueller Link) |
| **Darstellung** | Hell/Dunkel, Schriftgröße (3 Stufen), hoher Kontrast |

---

## Typischer Ablauf (kurz)

1. Prüfung anlegen (Name, Semester, Dozenten, Typ)  
2. HISinOne importieren → ggf. Antritt / Punkte  
3. Orphans zuordnen (THE/elektrP), offene Bewertungen schließen  
4. Noten prüfen, Szenarien vergleichen, bei Bedarf PDF/PNG teilen  
5. **JSON-Sicherung** → HISinOne-XLSX und gewünschte PDFs exportieren  

Ausführlich: [Benutzerhandbuch](docs/BENUTZERHANDBUCH.md).

---

## Schnellstart (lokal)

**Voraussetzungen:** Node.js 20+ (empfohlen), npm.

```bash
git clone <repo-url>
cd grading   # bzw. Projektordner
cp .env.example .env.local
# In .env.local: NEXT_PUBLIC_APP_PASSWORD=… setzen
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

Beispieldateien: [`sample/`](sample/) (`his-mini.xlsx`, `attendance-mini.xlsx`, `points-mini.xlsx`).

---

## Dokumentation

| Dokument | Zielgruppe |
|----------|------------|
| [**Benutzerhandbuch**](docs/BENUTZERHANDBUCH.md) | Prüferinnen und Prüfer – Workflow, Import, Export, Backup, Szenarien |
| [**Architektur**](docs/ARCHITEKTUR.md) | Entwicklung – Stack, Module, Datenhaltung |
| [**Deployment**](docs/DEPLOYMENT.md) | Betrieb – Vercel, Env, Teams, Troubleshooting |
| [**Security**](SECURITY.md) | Sicherheit – Audit, Auth-Hinweis, Härtung |
| [**Dokumentations-Index**](docs/README.md) | Übersicht und Themen-Map |

---

## App-Passwort (Pflicht)

Die Oberfläche ist mit einem **clientseitigen Zugangspasswort** geschützt (`sessionStorage`, pro Browser-Tab).

| Variable | Bedeutung |
|----------|-----------|
| `NEXT_PUBLIC_APP_PASSWORD` | Zugangspasswort (wird zur **Build-Zeit** ins Bundle eingebettet) |

- **Pflicht:** Ohne gesetzte Variable schlägt der **Production-/Vercel-Build** fehl (kein Default im Code).  
- **Lokal:** `.env.local` (Vorlage: [`.env.example`](.env.example)).  
- **Vercel:** Project → Settings → Environment Variables → Production **und** Preview, dann Redeploy.  

Das Passwort ist im Client-Bundle **lesbar** und nur eine Zugangshürde – Details: [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Scripts

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Entwicklungsserver (Turbopack) |
| `npm run build` | Production-Build |
| `npm start` | Build lokal ausliefern |
| `npm run lint` | ESLint |

---

## Tech-Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**  
- **Tailwind CSS 4** + shadcn/ui (Base UI)  
- **exceljs**, **jspdf** / jspdf-autotable, **Recharts**, **TanStack Table**  
- **localforage** (IndexedDB), **Zod**, **JSZip** (Semester-Export)  

---

## Datenschutz (Kurz)

- Keine Serverübertragung von Prüfungsdaten durch die App  
- Persistenz nur im jeweiligen Browser  
- JSON-Sicherungen und PDF/Excel-Exporte wie vertrauliche Prüfungsunterlagen behandeln  
- Auf geteilten Rechnern: Browserdaten und Session beachten  

---

## Highlights (0.4.x)

- Szenarien: Verteilungen (Notenstufen vor Einzelnoten), Tabelle neben Chart, Durchfaller über Szenarien, **PDF-Vergleich**  
- Diagramme: Vergrößern + **PNG mit Titel/Beschriftung**  
- Portfolio: optional **Teilnoten je Dozent** (Gleichgewichtung)  
- Gruppen, Namenssuche, Mehrfachzuordnung in der Bewertungsmatrix  
- JSON-Sicherungen: Dateiname mit Datum und Workflow-Schritt (**ohne Uhrzeit**)  

Ältere Änderungen: Git-Historie / Commits auf `main`.

---

## Lizenz & Kontakt

Internes Hochschul-Tool.  
© Prof. Dr. Wolfgang Hößl · OTH Regensburg · ExamGrade v0.4.44
