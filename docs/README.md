# Dokumentation ExamGrade

Zentrale Übersicht der Projektdokumentation.  
**App-Version:** 0.4.78 (abstimmen mit `package.json` und `src/lib/app-version.ts`)

| Dokument | Beschreibung |
|----------|--------------|
| [BENUTZERHANDBUCH.md](BENUTZERHANDBUCH.md) | **Vollständige Nutzerdokumentation** – Prüfungstypen, Workflow, Import, Bewertung, Noten, Szenarien, Export, No-Show, FAQ |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Technische Architektur, Module, Routing, Storage |
| [../GLOSSARY.md](../GLOSSARY.md) | Fachbegriffe der Notenbildung (Teilnote, Notenmittel, Ausgleich, …) |
| [adr/](adr/) | Entscheidungsnotizen, u. a. [0001 Portfolio-Gesamtnote / RaPO-Rundung](adr/0001-portfolio-gesamtnote-aus-teilnoten.md) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Umgebungsvariablen, Teams-Einbettung, Fehlerbehebung |
| [../SECURITY.md](../SECURITY.md) | Sicherheitsaudit und Betriebs-Checkliste |
| [ANALYSEBERICHT.html](ANALYSEBERICHT.html) | Tiefenanalyse v0.4.68 (Sicherheit, Daten, Noten, UX, KI-Kriterien) |
| [../README.md](../README.md) | Projektüberblick und Schnellstart (GitHub-Landing) |

## Empfohlene Lesereihenfolge

1. **Neu in der App?** → [BENUTZERHANDBUCH.md](BENUTZERHANDBUCH.md) (Inhaltsverzeichnis, Checklisten, FAQ)  
2. **Deployment / Passwort?** → [DEPLOYMENT.md](DEPLOYMENT.md)  
3. **Code beitragen / verstehen?** → [ARCHITEKTUR.md](ARCHITEKTUR.md) + [SECURITY.md](../SECURITY.md)  

## Themen-Map (Benutzerhandbuch)

| Thema | Abschnitt |
|-------|-----------|
| THE / elektrP / Klausur | §4, §7–9, §15 |
| StA, Portfolio, Gruppen, Korrektoren, No-Show | §4, §6, §10–11, §15 |
| Notenszenarien, Grenzfälle, Notenmittel/RaPO-Rundung | §12 |
| Notenliste PDF, HIS-Excel pro Studiengang | §13 |
| JSON-Sicherung, Semester-ZIP | §14 |
| Export gesperrt / FAQ | §16 |
| Glossar | §17 |

## Sample-Dateien

Mini-Beispiele für Imports: [`../sample/`](../sample/).
