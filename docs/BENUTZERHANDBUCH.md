# Benutzerhandbuch ExamGrade

Anleitung für Prüferinnen und Prüfer. Alle Daten bleiben **im Browser** (keine Serverübertragung von Notenlisten).

**Version:** 0.4.2

---

## 1. Voraussetzungen

| Punkt | Empfehlung |
|-------|------------|
| Browser | Aktuelles Chrome, Edge oder Firefox (Desktop) |
| Zugang | App-Passwort (von der IT/Betreuung bzw. aus `.env` / Vercel) |
| Dateien | HISinOne-Export, ggf. Moodle-Antritt und -Punkte (Excel) |
| Backup | JSON-Sicherungen speichern (USB/Netzlaufwerk) |

**MS Teams:** Die App kann als Website-Tab eingebettet werden. Downloads sind dort oft eingeschränkt – die App bietet dann einen Datei-Dialog oder einen manuellen Link am unteren Rand. Bei Problemen: „Im Browser öffnen“.

---

## 2. Erste Schritte

1. App-URL öffnen und **Passwort** eingeben.  
2. **Startseite:** vorhandene Prüfungen (Karten mit **Semester**, **Prüfungsform**, **Workflow-Status**) oder **Neue Prüfung**.  
3. Metadaten: Name, Prüfungsnummer(n), Semester, **Dozenten** (Vorschlagsliste oder Freitext, Chips), **Prüfungstyp**, Teilgebiete / Punktemaxima.  
4. Die **Workflow-Leiste** (links in der Prüfung) zeigt erledigte und offene Schritte.

### Prüfungstypen

| Typ | Typischer Ablauf |
|-----|------------------|
| **Take-Home-Exam (THE)** | HISinOne → Antritt → Matrikel-Zuordnung → Punkte → Noten → Export |
| **Elektronische Prüfung (elektrP)** | wie THE (Prüfung vor Ort, sonst gleicher Ablauf) |
| **Klausur** | HISinOne → Punkte (Vorlage/Import) → Noten → Export (kein Moodle-Antritt) |
| **Studienarbeit (StA) – Kriterien** | HISinOne → Kriterien definieren → Werte (%, Punkte oder Note) mit Gewichten → Note → Export |
| **Studienarbeit (StA) – manuelle Note** | HISinOne → Note manuell je Person → Export |
| **Portfolioprüfung** | HISinOne → Teilleistungen (Standard: 2) → Teilnoten → gewichtete Gesamtnote → Export |
| **Sonstige** | flexibel, je nach konfiguriertem Ablauf |

Bei StA und Portfolioprüfung können weitere Personen **manuell** unter Importe hinzugefügt werden (ohne HISinOne nur über die manuelle Notenmeldung exportierbar).

**Gruppen (StA / Portfolio):** Unter Einstellungen Gruppen anlegen, in der **Bewertungsmatrix** (Seite *Bewertung*) zuordnen und per Schaltflächen filtern. Hilfen: **Namenssuche** (mehrere Namen mit Komma), Hervorhebung von Personen **ohne Gruppe** und noch **unbefüllten** Gruppen (dürfen absichtlich leer bleiben), Personenzahl im Gruppen-Dropdown, **Mehrfachauswahl** (Checkboxen) mit Sammelzuordnung.

**Portfolioprüfung:** Gesamtnote = gewichteter Mittelwert der Teilnoten, gerundet auf die nächste deutsche Note (1,0 / 1,3 / … / 5,0). Optional in den Einstellungen (Standard **aus**): **Teilnoten je Dozent** – jeder Dozent vergibt Noten pro Teilleistung; die Teilnote ist das **gleichgewichtete Mittel** der Dozenten, danach wie bisher die gewichtete Gesamtnote.

**StA-Kriterien:** In der Matrix zeigen Spaltenköpfe Skalen-Badges (`0–100 %`, `Note 1–5`, `Punkte 0–…`), Placeholder und ⓘ-Tooltips mit Eingabehinweis.

---

## 3. Workflow im Überblick

### 3.1 THE / elektrP

1. **HISinOne-Masterliste** importieren (eine oder mehrere Studiengangs-Dateien).  
2. **Antrittsliste** (Moodle) importieren.  
3. **Matrikel-Zuordnung:** Orphans prüfen – zusammenführen oder ablehnen.  
4. **Punkte** importieren und offene manuelle Bewertungen abschließen.  
5. **Noten** prüfen (Szenarien, Overrides).  
6. **Sicherung nach Import** und später **nach Noten** (JSON).  
7. **Export:** HISinOne-XLSX + gewünschte PDFs/Notenspiegel.

### 3.2 Klausur

1. HISinOne-Masterliste importieren.  
2. Punktevorlage nutzen bzw. Punkte importieren/erfassen.  
3. Noten berechnen und prüfen.  
4. JSON-Sicherungen und HISinOne-/PDF-Export.

### 3.3 StA / Portfolio

1. HISinOne importieren (optional manuell Personen ergänzen).  
2. Einstellungen: Kriterien bzw. Teilleistungen, optional Gruppen und Dozenten-Teilnoten.  
3. Seite **Bewertung:** Matrix ausfüllen, Gruppen zuordnen.  
4. Noten/Szenarien prüfen → Sicherung → Export (HISinOne und/oder manuelle Noten-PDF).

Der Workflow blockiert Export und Teile der Notenliste, solange **offene Bewertungen** oder (bei THE/elektrP) **ungeprüfte Orphans** bestehen.

---

## 4. Import

Seite: **Importe** in der Prüfung.

| Datei | Inhalt |
|-------|--------|
| **HISinOne** | Offizielle Anmeldungsliste / Noteneintrag-Vorlage (`.xlsx`). Originalstruktur wird für den Re-Export mitgespeichert. |
| **Antritt** | Moodle-Antrittsliste (THE/elektrP). |
| **Punkte** | Moodle-Bewertung / Punkte-Excel mit Aufgaben-Spalten oder Gesamtpunkte. |

**Hinweise**

- Mehrere HISinOne-Dateien pro Prüfung möglich (verschiedene Studiengänge).  
- Sehr große Dateien werden abgelehnt (Excel max. ca. 15 MB, JSON-Sicherung max. ca. 50 MB).  
- Nach erfolgreichem Komplett-Import: Workflow-Schritt **Sicherung nach Import** nutzen.

Mini-Beispiele: [`sample/`](../sample/).

---

## 5. Matrikel-Zuordnung (THE / elektrP)

Seite: **Zuordnung**.

Wenn Antritt oder Punkte eine Matrikelnummer enthalten, die **nicht** in HISinOne vorkommt:

1. App schlägt Kandidaten vor (Ähnlichkeit Namen/Matrikel).  
2. **Zusammenführen** (mit Begründung) **oder ablehnen**.  
3. Sammelablehnung für Orphans ohne Vorschlag möglich.  
4. **Rückgängig** für Merges und Ablehnungen dokumentiert möglich.

Solange ungeprüfte Orphans existieren, bleiben Notenliste und HISinOne-Export **gesperrt**.

---

## 6. Punkte und Bewertung

| Seite | Nutzen |
|-------|--------|
| **Punkte** / Import | Matrix und importierte Werte |
| **Detailpunkte** | Aufgabenweise Bewertung, offene Felder |
| **Teilgebiete** | Mapping von Fragen auf Teilgebiete (falls genutzt) |
| **Bewertung** | StA-Kriterienmatrix bzw. Portfolio-Teilnoten; Gruppen, Suche, Mehrfachzuordnung |

**„Bewertung notwendig“:** Manuelle Aufgaben ohne Note blockieren den Notenschlüssel und den Export, bis alle erledigt sind.

---

## 7. Noten und Szenarien

| Seite | Nutzen |
|-------|--------|
| **Notenszenarien** | Bestehensgrenzen wählen und vergleichen (siehe unten) |
| **Noten** | Tabelle aller Studierenden; Filter nach Status und **Note** (Mehrfachauswahl 1,0–5,0 / ohne Note); Overrides, Kommentare, Szenario-Charts |
| **Notenspiegel** | Kennzahlen und Export PDF/Excel inkl. Diagramm |

### Empfehlung: Szenarien entscheiden

Sinnvolle Reihenfolge auf der Szenarien-Seite:

1. **Aktive Schwelle** setzen (welches Szenario steuert die echten Noten?).  
2. **Kennzahlen-Direktvergleich** und **Auswirkung des Wechsels** (besser / schlechter / neu bestanden).  
3. **Notenstufen** (Tabelle links, Chart rechts) – Fokus Bestehen/Durchfallen.  
4. **Einzelnoten 1,0–5,0** (Tabelle + Chart) – Feindetail.  
5. **Durchfaller über Szenarien** – wer fällt wo durch?  
6. Personentabelle „Wer profitiert / verliert?“  

Diagramme: **Klick zum Vergrößern**; **PNG speichern** enthält Titel und Beschriftung.  
**PDF Export** bündelt Kennzahlen, Verteilungen und Durchfaller-Analyse zum internen Austausch.

Manuelle Notenkorrekturen mit Kommentar dokumentieren.

---

## 8. Dokumente und Export

Seite: **Dokumente** bzw. **Export**.

| Export | Verwendung |
|--------|------------|
| **HISinOne-XLSX** | Upload ins Campus-System – Struktur der Originalvorlage, aktualisierte Noten |
| **Notenliste PDF** | Dokumentation |
| **Notenänderungen PDF** | Korrekturen nach Einsicht |
| **Manuelle Noten PDF** | z. B. für Abteilung Studium |
| **Durchfaller / Zweitkorrektur** | Listen |
| **Notenspiegel** | PDF und Excel |
| **Szenarienvergleich PDF** | Notenszenarien-Seite – Prüferaustausch |
| **Diagramm-PNG** | aus vergrößerter Ansicht oder PNG-Button |
| **JSON-Sicherung** | vollständiges Projekt |

Export ist gesperrt bei offenen Bewertungen, ungeprüften Orphans oder fehlender Original-HISinOne-Vorlage (je nach Typ).

PDFs können **alle hinterlegten Dozenten** ausweisen.

---

## 9. JSON-Sicherung und Wiederherstellung

### Sichern

- Über **Export / Sicherung**, Workflow-Meilensteine oder Startseite.  
- **Dateiname** (Beispiel): `2026-07-19_ExamGrade_MAP_nach-Noten.json` – **Datum + Prüfungsname + Schritt**, ohne Uhrzeit.  
- **Semester sichern:** ZIP aller Prüfungen mit dem aktuellen Semester-Label.  
- Mehrere JSON-Dateien auf der Startseite auf einmal importierbar.  
- Nach wesentlichen Änderungen erneut sichern, wenn die App eine **veraltete Sicherung** meldet.

### Wiederherstellen

1. Startseite → Sicherung importieren (eine oder mehrere JSON-Dateien).  
2. Kopie der Prüfung in **diesem** Browser.  
3. Relevante Daten (inkl. Base64-HISinOne-Vorlagen, falls importiert) stecken in der JSON-Datei.

---

## 10. Einstellungen und Darstellung

- **Einstellungen:** Metadaten, Typ, Dozenten (Hinzufügen per Liste/Freitext), Teilgebiete, StA-Kriterien, Portfolio-Teilleistungen, **Teilnoten je Dozent**, Studentengruppen.  
- **Darstellung** (Header): Hell/Dunkel, **Schriftgröße** (Standard / Groß / Sehr groß), hoher Kontrast – lokal im Browser.

---

## 11. Häufige Fragen

**Die Workflow-Schritte sind nicht alle grün, obwohl ich alles importiert habe.**  
Offene Detailbewertungen und (bei THE/elektrP) die Matrikel-Zuordnung prüfen.

**HISinOne-Export wird verweigert.**  
Oft fehlt die Originaldatei (erneut importieren) oder es gibt noch Orphans / offene Bewertungen.

**Download in Teams funktioniert nicht.**  
Dateidialog oder Banner am unteren Rand; alternativ im normalen Browser öffnen.

**Daten weg nach Browser-Wechsel / anderem PC.**  
Daten liegen nur im jeweiligen Browser – JSON-Sicherung importieren.

**Passwort vergessen.**  
Nur die Betreuung mit Zugriff auf Vercel-Env bzw. `.env.local` kann das Passwort setzen und die App neu bauen.

---

## 12. Verantwortungsvoller Umgang

- Prüfungsdaten sind personenbezogen – Gerät sperren, keine Screenshots in ungeschützte Kanäle.  
- JSON-, PDF- und Excel-Exporte wie Notenlisten behandeln.  
- Die App speichert **nicht** in der Cloud der App selbst; Browser-Sync kann IndexedDB mitnehmen – auf geteilten Konten vorsichtig sein.
