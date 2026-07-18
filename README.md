# ExamGrade

**Client-seitiges Prüfungsnoten-Tool** für deutsche Hochschulen – von der HISinOne-Masterliste über Antritt und Punkte bis zum formatgetreuen Notenexport.

© Prof. Dr. Wolfgang Hößl · OTH Regensburg · *Client-seitig · Keine Serverübertragung*

---

## Was ist ExamGrade?

ExamGrade ersetzt den klassischen Excel-Workflow (HISinOne → Antritt → Punkte → Note → Upload) durch eine geführte Web-Oberfläche im Browser. Alle Prüfungsdaten bleiben **lokal** (IndexedDB); es gibt **keine App-API** und **keine Übertragung von Noten an einen Server**.

Geeignet u. a. für:

- **Take-Home-Exams (THE)** und **elektronische Prüfungen (elektrP)** mit Moodle-Antritt und -Punkten  
- **Klausuren** mit Punktevorlage und Notenschlüssel  
- Mehrere HISinOne-Quellen (Studiengänge) in einer Prüfung  

---

## Funktionen

| Bereich | Inhalt |
|--------|--------|
| **Prüfungstypen** | THE, elektrP, Klausur, StA (Kriterien/manuell), **Portfolioprüfung**, Sonstige |
| **Import** | HISinOne-Noteneintrag (auch mehrere Dateien), Moodle-Antritt, Moodle-/Punkte-Excel |
| **Zuordnung** | Matrikel-Tippfehler: Vorschläge, manuell zusammenführen, ablehnen, rückgängig |
| **Bewertung** | Detailpunkte, offene Aufgaben („Bewertung notwendig“), Teilgebiete |
| **Noten** | Szenarien (Bestehensgrenzen), Overrides, Notenspiegel mit Diagrammen |
| **Export** | Formatgetreues HISinOne-XLSX, Notenliste/Änderungen/Manuell/Durchfaller (PDF), Notenspiegel PDF/Excel, JSON-Sicherung |
| **Workflow** | Fortschrittsanzeige, Meilensteine „Sicherung nach Import/Noten“ |
| **Teams** | Einbettung als Website-Tab; robuste Downloads (File-Picker / manueller Link) |
| **Darstellung** | Hell/Dunkel, Schrift, hoher Kontrast |

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

App öffnen: [http://localhost:3000](http://localhost:3000)

Beispieldateien: [`sample/`](sample/) (`his-mini.xlsx`, `attendance-mini.xlsx`, `points-mini.xlsx`).

---

## Dokumentation

| Dokument | Zielgruppe |
|----------|------------|
| [**Benutzerhandbuch**](docs/BENUTZERHANDBUCH.md) | Prüferinnen und Prüfer – Workflow, Import, Export, Backup |
| [**Architektur**](docs/ARCHITEKTUR.md) | Entwicklung – Stack, Module, Datenhaltung |
| [**Deployment**](docs/DEPLOYMENT.md) | Betrieb – Vercel, Env, Teams, Troubleshooting |
| [**Security**](SECURITY.md) | Sicherheit – Audit, Auth-Hinweis, Härtung |
| [**Dokumentations-Index**](docs/README.md) | Übersicht aller Docs |

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
- **localforage** (IndexedDB), **Zod** (Import-Validierung)  

---

## Datenschutz (Kurz)

- Keine Serverübertragung von Prüfungsdaten durch die App  
- Persistenz nur im jeweiligen Browser  
- JSON-Sicherungen wie vertrauliche Prüfungsunterlagen behandeln  
- Auf geteilten Rechnern: Browserdaten und Session beachten  

---

## Lizenz & Kontakt

Internes Hochschul-Tool.  
© Prof. Dr. Wolfgang Hößl · OTH Regensburg · ExamGrade v0.3.1
