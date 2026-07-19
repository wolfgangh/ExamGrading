# Deployment ExamGrade

Betrieb auf Vercel (empfohlen) und lokale Production-Builds.

---

## 1. Voraussetzungen

- GitHub-/Git-Repository mit diesem Projekt  
- Vercel-Account mit Projektbindung  
- Gewähltes **starkes** Zugangspasswort (nicht im Git committen)

---

## 2. Vercel – Ersteinrichtung

1. [vercel.com](https://vercel.com) → Projekt aus dem Repo importieren.  
2. Framework-Preset: **Next.js** (Standard).  
3. Build-Command: `next build` / `npm run build` (Default).  
4. **Environment Variable** anlegen (vor dem ersten erfolgreichen Production-Build mit P0-Code):

| Name | Wert | Environments |
|------|------|--------------|
| `NEXT_PUBLIC_APP_PASSWORD` | Ihr Passwort | **Production**, **Preview** (empfohlen auch Development) |

5. Deploy starten bzw. nach Env-Änderung **Redeploy**.

### Wichtig zu `NEXT_PUBLIC_*`

- Die Variable wird beim **Build** in den Client-JS-Bundle geschrieben.  
- Sie ist im Browser **lesbar** (Zugangshürde, kein Server-Secret).  
- Änderungen an der Variable wirken erst nach **neuem Deployment**.  

Es gibt auf Vercel **keine** manuell hochgeladene `.env`-Datei im Live-Dateisystem – nur die Project Environment Variables (Dashboard oder CLI).

### CLI

```bash
vercel env add NEXT_PUBLIC_APP_PASSWORD production
vercel env add NEXT_PUBLIC_APP_PASSWORD preview
vercel --prod
```

Lokal Development-Vars von Vercel holen (nicht committen):

```bash
vercel env pull .env.local
```

---

## 3. Build-Verhalten ohne Passwort

In `next.config.ts`:

- Wenn `NODE_ENV === "production"` **oder** `VERCEL === "1"`  
- und `NEXT_PUBLIC_APP_PASSWORD` fehlt/leer ist  

→ **Build bricht mit klarer Fehlermeldung ab.**

Damit Preview-Deploys nicht fehlschlagen: Variable auch für **Preview** setzen.

---

## 4. MS Teams Website-Tab

1. Teams → Team/Kanal → Tab hinzufügen → **Website**.  
2. Production-URL der Vercel-App eintragen.  
3. Nutzer melden sich mit dem App-Passwort an.

**Hinweise**

- Die App setzt **kein** `X-Frame-Options: DENY`, damit Framing funktioniert.  
- Automatische Downloads sind in Teams oft blockiert → File-Picker oder Download-Banner in der App.  
- Bei anhaltenden Problemen: Link „Im Browser öffnen“ nutzen.

Details Downloads: `src/lib/download.ts`.

---

## 5. Lokaler Production-Build

```bash
# .env.local oder Export der Variable im Shell
set NEXT_PUBLIC_APP_PASSWORD=geheim   # Windows PowerShell: $env:NEXT_PUBLIC_APP_PASSWORD="…"
npm run build
npm start
```

Ohne Variable schlägt `npm run build` fehl.

---

## 6. Checkliste vor Go-Live

- [ ] `NEXT_PUBLIC_APP_PASSWORD` Production + Preview gesetzt  
- [ ] Redeploy nach Env-Änderung  
- [ ] Login mit dem **neuen** Passwort getestet  
- [ ] Beispiel-Import und HISinOne-Export getestet  
- [ ] Optional: Teams-Tab getestet  
- [ ] JSON-Backup-Prozess den Nutzern kommuniziert  
- [ ] [SECURITY.md](../SECURITY.md) Betriebs-Checkliste gelesen  

---

## 7. Troubleshooting

| Symptom | Mögliche Ursache | Maßnahme |
|---------|------------------|----------|
| Vercel-Build: Passwort fehlt | Env nicht gesetzt / falsches Environment | Variable für Production/Preview setzen, Redeploy |
| Login akzeptiert altes Passwort | Alter Build | Redeploy nach Env-Änderung |
| Login „nicht konfiguriert“ lokal | Keine `.env.local` | Anlegen, Dev-Server neu starten |
| Preview-Deploy rot, Production grün | Preview-Env fehlt | Variable für Preview ergänzen |
| Download in Teams leer | iframe-Restriktion | Banner / File-Picker / Browser |
| Daten „weg“ auf anderem PC | IndexedDB ist geräte-/browsergebunden | JSON-Sicherung importieren |
| Import „Datei zu groß“ | Limit 15 MB Excel / 50 MB JSON | Datei verkleinern oder splitten |

---

## 8. Weiterführend

- Sicherheit und Auth-Modell: [SECURITY.md](../SECURITY.md)  
- Architektur: [ARCHITEKTUR.md](ARCHITEKTUR.md)  
- Nutzung: [BENUTZERHANDBUCH.md](BENUTZERHANDBUCH.md)  
- Projektüberblick (GitHub): [../README.md](../README.md)  

App-Version im UI: `src/lib/app-version.ts` (mit `package.json` abstimmen).  

