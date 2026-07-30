# Meldungen an ExamGrade (Bug, Feature, Frage)

Issues werden über **GitHub** entgegengenommen. Strukturierte Formulare erscheinen beim Anlegen eines Issues:

**https://github.com/wolfgangh/ExamGrading/issues/new/choose**

| Typ | Direktlink |
|-----|------------|
| Fehler (Bug) | [Bug melden](https://github.com/wolfgangh/ExamGrading/issues/new?template=bug_report.yml) |
| Feature | [Feature vorschlagen](https://github.com/wolfgangh/ExamGrading/issues/new?template=feature_request.yml) |
| Frage | [Frage stellen](https://github.com/wolfgangh/ExamGrading/issues/new?template=question.yml) |

In der laufenden App: Footer → **Feedback & Fehler melden** (kopiert Umgebungsinfos und öffnet die passende GitHub-Vorlage).

---

## Datenschutz

**Nicht** in Issues oder Anhängen:

- Matrikelnummern, Namen, Notenlisten  
- Vollständige JSON-/ZIP-Projektsicherungen mit Studierenden  
- Screenshots, auf denen personenbezogene Daten lesbar sind  

Technische Infos (App-Version, Browser, Prüfungs**form** ohne Personen) sind willkommen.

---

## Markdown-Vorlagen (E-Mail / manuell)

Falls GitHub-Formulare nicht genutzt werden können, diese Blöcke kopieren und ausfüllen.

### Bug

```markdown
## Kurzbeschreibung
…

## Schritte zur Reproduktion
1. …
2. …

## Erwartetes Verhalten
…

## Tatsächliches Verhalten
…

## Prüfungsform
[ ] n/a  [ ] THE  [ ] elektrP  [ ] Klausur  [ ] StA  [ ] Portfolio  [ ] Sonstige

## Umgebung
- App-Version:
- Browser / Gerät:
- Teams-Einbettung: ja / nein
- Schweregrad: Blocker / Hoch / Mittel / Niedrig

## Weitere Hinweise
…
```

### Feature

```markdown
## Problem / Motivation
…

## Vorgeschlagene Lösung
…

## Alternativen / Workarounds
…

## Vor allem relevant für
[ ] App-weit  [ ] THE/elektrP  [ ] Klausur  [ ] StA  [ ] Portfolio  [ ] Import/Export

## Wichtigkeit
[ ] Nice-to-have  [ ] spürbar  [ ] dringend
```

### Frage

```markdown
## Frage
…

## Kontext (Prüfungsform, Workflow-Schritt)
…

## App-Version
…
```
