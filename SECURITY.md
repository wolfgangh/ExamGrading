# Sicherheitsaudit ExamGrade

**Stand:** 2026-07-18  
**Scope:** Codebase `src/` (Auth, Storage, Import/Export, UI, Next-Config)  
**Methode:** Statische Code-Review typischer Client-SPA-Schwachstellen (XSS/Sanitizing, Auth, untrusted Files, Storage, HTTP-Header, Supply Chain)

---

## Umsetzungsstatus

| Prio | Maßnahme | Status |
|------|----------|--------|
| P0 | Default-Passwort entfernen / Build ohne Env | **Umgesetzt** (`app-auth.ts`, Guard in `next.config.ts`) |
| P1 | Security-Headers (CSP light, nosniff, referrer) | **Umgesetzt** (`next.config.ts`) – ohne Frame-Deny (Teams) |
| P1 | JSON-Import Size-Limit + sanftes Zod | **Umgesetzt** (50 MB, Pflichtfelder id/name) |
| P2 | Excel Size-Limit | **Umgesetzt** (15 MB in `loadWorkbookFromFile`) |
| P2 | Login-Hinweis Zugangshürde | **Umgesetzt** |
| niedrig | Download-Dateinamen härten | **Umgesetzt** |
| P3 | Idle-Logout | **Nicht umgesetzt** (UX: Unterbrechung langer Korrekturen) |
| — | DOMPurify / Server-Auth | **Nicht umgesetzt** (unnötig bzw. Architekturwechsel) |

**Limits:** `src/lib/import-limits.ts`  
**Sanfte JSON-Validierung:** `src/lib/project-archive.ts` (Zod passthrough)

---

## 1. Architektur & Bedrohungsmodell

ExamGrade ist eine **client-only** Next.js-15-Anwendung:

| Aspekt | Ist-Zustand |
|--------|-------------|
| Backend / API-Routen der App | **Keine** (kein `app/api`) |
| Persistenz | Browser **IndexedDB** (localforage) |
| Auth | Client-Passwort-Gate (`sessionStorage`) |
| Datenfluss | Import Excel/JSON → lokal verarbeiten → Export PDF/XLSX/JSON |
| Hosting | Typisch Vercel; optional MS-Teams Website-Tab (iframe) |

**Bedrohungsmodell (kurz):**

- **Vertrauenswürdig:** der Prüfer am Gerät, legitime HISinOne-/Antritts-/Punkte-Dateien aus dem eigenen Workflow.
- **Untrusted:** fremde JSON-Sicherungen, fremde Excel-Dateien, XSS in der eigenen Origin, Mitnutzer des gleichen Browsers/Geräts, jeder mit Zugriff auf das gebaute JS-Bundle.
- **Nicht Ziel der App:** serverseitiger Geheimnisschutz, Multi-Tenant-Isolation, Schutz vor Gerätezugriff (forensisch / geteiltes Gerät).

Für den vorgesehenen Einsatz (interne Prüfer, Browser, ggf. Teams) ist die Architektur **nachvollziehbar**. Sie bietet **keinen** Schutz vor entschlossenen Angreifern mit Bundle-Zugang, XSS in der Origin oder physischem Gerätezugriff.

---

## 2. Gesamteinschätzung

| Bereich | Risiko | Kommentar |
|---------|--------|-----------|
| Klassisches XSS (React-Text) | **Niedrig** | React escaped Standard-Renderings; kein User-HTML |
| Auth / Geheimnisse | **Hoch (by design)** | Passwort im Bundle; Session fälschbar |
| Untrusted File-Import (JSON/Excel) | **Niedrig–Mittel** | Size-Limits + sanfte Schema-Prüfung umgesetzt |
| Datenschutz / XSS → lokale Daten | **Mittel–Hoch** | Alle Klausurdaten unverschlüsselt lokal; XSS = Vollzugriff |
| Server-Angriffe (SQLi, CSRF, RCE-API) | **n/a / niedrig** | Keine App-API, kein serverseitiges DB |
| HTTP-Security-Header | **Niedrig** (nach Fix) | CSP light + nosniff + referrer; Framing erlaubt für Teams |
| Supply Chain | **Niedrig–Mittel** | Übliche Client-Libs; Audit empfohlen |

---

## 3. Befunde im Detail

### 3.1 Authentifizierung (kritisch / by design)

**Dateien:** `src/lib/app-auth.ts`, `src/components/auth/auth-gate.tsx`, `src/components/auth/login-screen.tsx`

| Befund | Detail |
|--------|--------|
| Passwort im Client-Bundle | `NEXT_PUBLIC_APP_PASSWORD` wird zur **Build-Zeit** eingebettet und ist im ausgelieferten JS lesbar |
| Hardcodierter Fallback | **Entfernt (P0)** – kein `DEFAULT_APP_PASSWORD` mehr; Production-Build/`VERCEL` ohne Env bricht ab |
| Session ohne Kryptografie | `sessionStorage["exam-grade-auth"] = "authenticated"` – fester String, **ohne** Token/HMAC/Signatur; in DevTools setzbar |
| Kein Rate-Limit | Client-only; Brute-Force ohnehin umgehbar (Passwort im Bundle bzw. Session setzen) |

**Bewertung:** Im Code und Login-UI als **Zugangshürde** dokumentiert, nicht als Geheimnisschutz. Jeder mit dem Production-Bundle kennt das effektive Passwort aus der Build-Env.

**Vercel-Betrieb:** Siehe [§9](#9-vercel-passwort-setzen-hochp0) – Env muss gesetzt bleiben, sonst schlägt der Build fehl.

**Offen (Architektur):** Echte Absicherung nur mit Server-Auth (z. B. OIDC / Vercel Auth).

---

### 3.2 XSS, HTML-Injection, Sanitizing

**Befunde:**

| Stelle | Bewertung |
|--------|-----------|
| UI-Texte (Namen, Matrikel, Kommentare, Excel-Zellen) | Überwiegend React-Children `{text}` → **automatisches Escaping** |
| `dangerouslySetInnerHTML` | Nur festes Theme-Init-Script in `src/app/layout.tsx` – **kein** User-/Import-Input im HTML-String |
| Download-Fallback (`src/lib/download.ts`) | `textContent` / DOM-APIs für sichtbaren Link; Dateiname nicht via `innerHTML` |
| PDF-Export (`src/lib/pdf/*`) | Text-Rendering (jspdf); kein HTML-Kontext für Studentenfelder |
| Links / Routing | App-interne Pfade `/exam/${id}/…`; IDs aus Storage/UUID |

**Sanitizing-Fazit:**

- Für das **aktuelle reine Text-UI** ist **kein** DOMPurify o. Ä. erforderlich.
- Sanitizing wäre relevant bei: Rich-Text, HTML-Export in DOM, `dangerouslySetInnerHTML` mit Import-Daten, oder Markdown mit HTML.

**Restrisiko:** XSS-Bug in einer Dependency oder künftige Features mit unkontrolliertem HTML. CSP (umgesetzt) mindert Impact.

---

### 3.3 JSON-Projektsicherung (Import) — gehärtet

**Dateien:** `src/lib/project-archive.ts`, `src/lib/import-limits.ts`, `src/components/exams/exam-list.tsx`

| Maßnahme | Detail |
|----------|--------|
| Size-Limit | **50 MB** (`MAX_PROJECT_ARCHIVE_BYTES`) vor Parse und beim File-Picker |
| Schema | Zod: Pflicht `id` + `name` (string, nicht leer); **passthrough** für übrige Felder |
| Migration | Danach weiterhin `normalizeProject` / `migrateExamProject` |

**Funktionswirkung:** Nur extrem große oder ohne id/name versehene Dateien werden abgelehnt. Legacy-Sicherungen mit Zusatzfeldern bleiben importierbar.

---

### 3.4 Excel-Import — gehärtet

**Dateien:** `src/lib/excel/workbook.ts`, `src/lib/import-limits.ts`

| Maßnahme | Detail |
|----------|--------|
| Size-Limit | **15 MB** vor `arrayBuffer` / exceljs-Load |
| Zeilenlimit | `worksheetToMatrix(..., maxRows = 5000)` unverändert |

**Funktionswirkung:** Typische HIS-/Antritts-/Punkte-Dateien sind weit unter 15 MB. Größere Dateien erhalten eine klare Fehlermeldung.

---

### 3.5 Downloads / Blob-URLs — gehärtet

**Datei:** `src/lib/download.ts`

- `URL.createObjectURL` + verzögertes `revokeObjectURL`.
- `sanitizeDownloadFilename`: verbotene Pfadzeichen, Control-Chars, max. 180 Zeichen.
- Fallback-Leiste: `textContent` für Dateiname (kein `innerHTML`).
- `rel="noopener"` bei Anchor/Window-Open wo gesetzt.

---

### 3.6 Client-Storage & Datenschutz

**Dateien:** `src/lib/storage.ts`, Preferences in `src/lib/preferences.ts`

| Thema | Ist-Zustand |
|-------|-------------|
| IndexedDB | Vollständige Projekte: Noten, HIS-Zeilen, Antritte, Punkte, Base64-Original-XLSX, Matching-Metadaten |
| Verschlüsselung at rest | **Keine** |
| XSS / Gerätezugriff | Lesen/Schreiben aller lokalen Projekte möglich |
| URL-Query | Keine sensiblen Noten in Query vorgesehen |
| Transparenz | Footer + Login-Hinweis: client-seitig, keine Serverübertragung |

**Offen (bewusst):** Idle-Logout – würde UX bei langen Korrektursessions beeinträchtigen (Daten bleiben in IndexedDB, aber erneutes Login nötig).

---

### 3.7 HTTP-Security-Header — umgesetzt

**Datei:** `next.config.ts`

Gesetzt:

- `Content-Security-Policy` (default-src self; script/style mit unsafe-inline/unsafe-eval für Next + Theme-Script; img/font data+blob; worker blob; object-src none)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Bewusst nicht gesetzt:**

- `X-Frame-Options: DENY` / `frame-ancestors 'none'` – würde **MS Teams Website-Tab** brechen.

**Funktionswirkung Vercel:** Headers werden von Next ausgeliefert; kein Einfluss auf Build/Env. Framing bleibt erlaubt.

---

### 3.8 Theme-Init-Script & localStorage

**Datei:** `src/app/layout.tsx`

- Inline-Script liest Appearance-Prefs aus `localStorage` und setzt CSS-Klassen.
- Storage-Key kommt aus `JSON.stringify(APPEARANCE_STORAGE_KEY)` (statischer App-Key).
- `JSON.parse` in try/catch; bei Fehler stiller Fallback.

**Risiko:** niedrig. CSP erlaubt `'unsafe-inline'` für dieses Script.

---

### 3.9 Dependency / Supply Chain

| Paket | Rolle |
|-------|--------|
| `next` 15.x | Framework / Build |
| `react` / `react-dom` 19.x | UI |
| `exceljs` | Excel Import/Export |
| `jspdf` / `jspdf-autotable` | PDF |
| `localforage` | IndexedDB-Wrapper |
| `zod` | Sanfte Archiv-Validierung |

**Empfehlung:** regelmäßig `npm audit`; Dependencies pin/update bei CVEs.

---

## 4. Was **nicht** (oder nur schwach) anwendbar ist

| Thema | Warum nicht dringend |
|-------|----------------------|
| HTML-Sanitizer für alle Inputs | React escaped Text; kein Rich-HTML |
| CSRF | Keine Cookie-basierte App-API-Session |
| SQL-Injection | Kein App-DB-Server |
| SSRF / Server-RCE | Keine Server-Fetcher der App für User-URLs |
| Klassische Multi-User-Rechte | Single-user pro Browser-Profil |

---

## 5. Offene Maßnahmen (Backlog)

| Prio | Maßnahme | Aufwand | Wirkung |
|------|----------|---------|---------|
| **P3** | Idle-Logout / Session-Timeout | klein | Geteilte Rechner (UX-Tradeoff) |
| **—** | Server-Auth (OIDC o. Ä.) | groß | Echter Zugangsschutz |

---

## 6. Auswirkung der umgesetzten Fixes auf die Funktionalität

| Fix | Risiko für Workflow / Vercel |
|-----|------------------------------|
| Security-Headers | Keines bei normaler Nutzung; Teams-iframe bleibt erlaubt |
| JSON 50 MB + Zod id/name | Nur Monster-Dateien / kaputte JSON ohne id/name abgelehnt |
| Excel 15 MB | Nur ungewöhnlich große XLSX abgelehnt |
| Login-Hinweis | Keine Runtime-Wirkung |
| Filename-Sanitize | Keine; nur Download-Namen |

---

## 7. Betriebs-Checkliste (Deploy)

- [ ] `NEXT_PUBLIC_APP_PASSWORD` in Production **und** Preview gesetzt (stark) – siehe §9
- [ ] Nach Env-Änderung **Redeploy** (sonst schlägt Build ggf. fehl oder altes Bundle bleibt)
- [ ] Bewusstsein: Passwort ist im Client-Bundle sichtbar – nur Hürde
- [ ] Keine echten Server-Secrets in `NEXT_PUBLIC_*`
- [ ] Teams-Embed: Frame-Deny nicht setzen (aktuell korrekt)
- [ ] Regelmäßig Dependencies / `npm audit`
- [ ] Nutzer: geteilte PCs → Browser-Daten/Session beachten; JSON-Sicherungen wie Prüfungsunterlagen behandeln

---

## 8. Code-Map (relevante Dateien)

| Bereich | Pfad |
|---------|------|
| Auth | `src/lib/app-auth.ts`, `src/components/auth/*` |
| Root Layout / Theme-Script | `src/app/layout.tsx` |
| Storage / IndexedDB | `src/lib/storage.ts` |
| JSON-Archiv | `src/lib/project-archive.ts` |
| Import-Limits | `src/lib/import-limits.ts` |
| Excel Load/Matrix | `src/lib/excel/workbook.ts`, `src/lib/excel/parse-*.ts` |
| Downloads | `src/lib/download.ts` |
| PDF | `src/lib/pdf/*` |
| Next Config / Headers | `next.config.ts` |
| Typen Projekt | `src/lib/types.ts` |
| Export-Validierung (fachlich) | `src/lib/validations.ts` |

---

## 9. Vercel: Passwort setzen (Hoch/P0)

### Wichtiger Hinweis zu `NEXT_PUBLIC_*`

In Vercel gibt es **keine** separate „.env-Datei“ im Deployment-Dateisystem wie lokal. Stattdessen:

- Variablen werden im **Dashboard** (oder per CLI) am **Projekt** hinterlegt.
- Beim **Build** werden `NEXT_PUBLIC_*`-Werte in den Client-JS-**Bundle** eingebettet.
- Das Passwort ist danach **im Browser lesbar** – es bleibt eine Zugangshürde, kein Server-Geheimnis.
- Env-Änderungen gelten erst nach einem **neuen Deployment** (Redeploy / Git-Push).

### Dashboard (empfohlen)

1. [Vercel Dashboard](https://vercel.com/dashboard) öffnen → Projekt wählen.
2. **Settings** → **Environment Variables**.
3. Variable anlegen:
   - **Key:** `NEXT_PUBLIC_APP_PASSWORD`
   - **Value:** starkes Passwort (nicht `oth-regensburg`)
   - **Environments:** mindestens **Production**; empfohlen auch **Preview** und **Development**
4. **Save**.
5. **Redeploy:** Deployments → letztes Deployment → **⋯** → **Redeploy**  
   (oder neuer Commit auf den Production-Branch).
6. Im Login der Live-URL das **neue** Passwort testen.

### CLI

```bash
# Interaktiv Wert eingeben
vercel env add NEXT_PUBLIC_APP_PASSWORD production
vercel env add NEXT_PUBLIC_APP_PASSWORD preview
vercel env add NEXT_PUBLIC_APP_PASSWORD development

# Production neu bauen/deployen
vercel --prod
```

Lokal Development-Vars von Vercel holen (optional, **nicht** committen):

```bash
vercel env pull .env.local
```

### Was Env-Setzen allein **nicht** behebt

| Problem | Nach Env in Vercel + P0-Code |
|---------|------------------------------|
| Passwort im Client-Bundle sichtbar | **weiterhin ja** (`NEXT_PUBLIC_*`) |
| `sessionStorage = "authenticated"` fälschbar | **weiterhin ja** |
| Code-Default `oth-regensburg` | **behoben** – kein Default; Build ohne Env bricht ab |

**Vollständige Absicherung:** Server-seitige Auth (OIDC o. Ä.) – Architekturwechsel.

---

## 10. Änderungshistorie dieses Dokuments

| Datum | Änderung |
|-------|----------|
| 2026-07-18 | Erstes Sicherheitsaudit (nur Dokumentation) |
| 2026-07-18 | Mittel/Niedrig umgesetzt (Headers, Import-Limits, Zod light, Login-Hinweis, Filename); Vercel-Anleitung P0; Idle-Logout bewusst offen |
| 2026-07-18 | P0: Default-Passwort entfernt; Production/Vercel-Build ohne `NEXT_PUBLIC_APP_PASSWORD` bricht ab |
