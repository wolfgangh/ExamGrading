# Benutzerhandbuch ExamGrade

Anleitung für Prüferinnen und Prüfer. Alle Daten bleiben **im Browser** (keine Serverübertragung von Notenlisten).

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
2. Startseite: vorhandene Prüfungen oder **Neue Prüfung**.  
3. Metadaten setzen: Name, Prüfungsnummer(n), Semester, Dozenten, **Prüfungstyp**, Teilgebiete / Punktemaxima je nach Dialog.  
4. Die **Workflow-Leiste** (links in der Prüfung) zeigt erledigte und offene Schritte.

### Prüfungstypen

| Typ | Typischer Ablauf |
|-----|------------------|
| **Take-Home-Exam (THE)** | HISinOne → Antritt → Matrikel-Zuordnung → Punkte → Noten → Export |
| **Elektronische Prüfung (elektrP)** | wie THE (Prüfung vor Ort, sonst gleicher Ablauf) |
| **Klausur** | HISinOne → Punkte (Vorlage/Import) → Noten → Export (kein Moodle-Antritt) |
| **Studienarbeit (StA) – Kriterien** | HISinOne → Kriterien definieren → Werte (%, Punkte oder Note) mit Gewichten → Note → Export; in der Matrix: Skalen-Badge, Placeholder und ⓘ-Tooltip pro Kriterium |
| **Studienarbeit (StA) – manuelle Note** | HISinOne → Note manuell je Person → Export |
| **Portfolioprüfung** | HISinOne → Teilleistungen (Standard: 2) benennen/gewichten → Teilnoten → gewichtete Gesamtnote → Export |
| **Sonstige** | flexibel, je nach konfiguriertem Ablauf |

Bei StA und Portfolioprüfung können weitere Personen **manuell** unter Importe hinzugefügt werden (ohne HISinOne nur über die manuelle Notenmeldung exportierbar).

**Gruppen (StA / Portfolio):** Unter Einstellungen Gruppen anlegen, in der Bewertungsmatrix (bzw. Notenübersicht) zuordnen und per Schaltflächen filtern – so lassen sich Noten pro Gruppe eintragen und schnell zwischen Gruppen wechseln. In der Bewertungsmatrix: **Namenssuche** (mehrere Namen mit Komma), Hervorhebung von Personen **ohne Gruppe** und von noch **unbefüllten** Gruppen (dürfen absichtlich leer bleiben), Personenzahl im Gruppen-Dropdown, sowie **Mehrfachauswahl** (Checkboxen) mit Sammelzuordnung zu einer Gruppe.

**Portfolioprüfung:** Gesamtnote = gewichteter Mittelwert der Teilnoten, gerundet auf die nächste deutsche Note (1,0 / 1,3 / … / 5,0). Optional (Einstellungen, Standard aus): **Teilnoten je Dozent** – jeder Dozent vergibt Noten pro Teilleistung; die Teilnote ist das **gleichgewichtete Mittel** der Dozenten, danach wie bisher die gewichtete Gesamtnote.

---

## 3. Workflow im Überblick

### 3.1 THE / elektrP

1. **HISinOne-Masterliste** importieren (eine oder mehrere Studiengangs-Dateien).  
2. **Antrittsliste** (Moodle) importieren.  
3. **Matrikel-Zuordnung:** Einträge ohne HISinOne-Treffer (Orphans) prüfen – zusammenführen oder ablehnen.  
4. **Punkte** importieren (Moodle-Detail/Gesamt) und offene manuelle Bewertungen abschließen.  
5. **Noten** prüfen (Szenarien, Overrides).  
6. **Sicherung nach Import** und später **nach Noten** (JSON).  
7. **Export:** HISinOne-XLSX + gewünschte PDFs/Notenspiegel.

### 3.2 Klausur

1. HISinOne-Masterliste importieren.  
2. Punktevorlage nutzen bzw. Punkte importieren/erfassen.  
3. Noten berechnen und prüfen.  
4. JSON-Sicherungen und HISinOne-/PDF-Export.

Der Workflow blockiert Export und Teile der Notenliste, solange **offene Bewertungen** oder (bei THE/elektrP) **ungeprüfte Orphans** bestehen.

---

## 4. Import

Seite: **Importe** in der Prüfung.

| Datei | Inhalt |
|-------|--------|
| **HISinOne** | Offizielle Anmeldungsliste / Noteneintrag-Vorlage (`.xlsx`). Originalstruktur wird für den Re-Export mitgespeichert. |
| **Antritt** | Moodle-Antrittsliste (THE/elektrP). |
| **Punkte** | Moodle-Bewertung / Punkte-Excel mit Aufgaben-Spalten (z. B. F1, F2 …) oder Gesamtpunkte. |

**Hinweise**

- Mehrere HISinOne-Dateien pro Prüfung möglich (verschiedene Studiengänge).  
- Sehr große Dateien werden abgelehnt (Excel max. ca. 15 MB, JSON-Sicherung max. ca. 50 MB).  
- Nach erfolgreichem Komplett-Import: Workflow-Schritt **Sicherung nach Import** nutzen.

Mini-Beispiele: [`sample/`](../sample/).

---

## 5. Matrikel-Zuordnung (THE / elektrP)

Seite: **Zuordnung**.

Wenn Antritt oder Punkte eine Matrikelnummer enthalten, die **nicht** in HISinOne vorkommt (Tippfehler, andere Schreibweise):

1. App schlägt Kandidaten vor (Ähnlichkeit Namen/Matrikel).  
2. Sie **führen zusammen** (mit Begründung) **oder lehnen ab** (bewusst keine Zusammenführung).  
3. Sammelablehnung für Orphans ohne Vorschlag ist möglich.  
4. **Rückgängig** ist für Merges und Ablehnungen dokumentiert möglich.

Solange ungeprüfte Orphans existieren, bleiben Notenliste und HISinOne-Export **gesperrt**.

---

## 6. Punkte und Bewertung

| Seite | Nutzen |
|-------|--------|
| **Punkte** / Import | Matrix und importierte Werte |
| **Detailpunkte** | Aufgabenweise Bewertung, offene Felder |
| **Teilgebiete** | Mapping von Fragen auf Teilgebiete (falls genutzt) |

**„Bewertung notwendig“:** Manuelle Aufgaben ohne Note blockieren den Notenschlüssel und den Export, bis alle erledigt sind. Die Workflow-Anzeige markiert das als kritischen offenen Schritt.

---

## 7. Noten und Szenarien

| Seite | Nutzen |
|-------|--------|
| **Notenszenarien** | Verschiedene Bestehensgrenzen / Schwellen vergleichen, aktives Szenario wählen |
| **Noten** | Tabelle aller Studierenden, Status, Overrides, Kommentare, Szenario-Impact |
| **Notenspiegel** | Verteilung, Kennzahlen (Mittel, Median), Export PDF/Excel inkl. Diagramme |

Manuelle Notenkorrekturen (z. B. nach Klausureinsicht) mit Kommentar dokumentieren; die vorherige Note wird wo vorgesehen festgehalten.

---

## 8. Dokumente und Export

Seite: **Dokumente** bzw. **Export**.

Typische Ausgaben:

| Export | Verwendung |
|--------|------------|
| **HISinOne-XLSX** | Upload ins Campus-System – **gleiche Struktur** wie die importierte Originaldatei, aktualisierte Notenspalte |
| **Notenliste PDF** | Dokumentation / Aushang-Vorbereitung |
| **Notenänderungen PDF** | Korrekturen nach Einsicht |
| **Manuelle Noten PDF** | für Abteilung Studium o. Ä. |
| **Durchfaller / Zweitkorrektur** | Listen und Vorlagen-Kontext |
| **Notenspiegel** | PDF und Excel |
| **JSON-Sicherung** | vollständiges Projekt inkl. Importe und Metadaten |

Export ist gesperrt, solange Validierungsfehler bestehen (u. a. offene Bewertung, ungeprüfte Orphans, fehlende Original-HISinOne-Vorlage).

---

## 9. JSON-Sicherung und Wiederherstellung

### Sichern

- Über **Export / Sicherung** oder die Workflow-Meilensteine.  
- Datei sicher ablegen (nicht nur im Browser).  
- Nach jeder wesentlichen Änderung erneut sichern, wenn die App eine **veraltete Sicherung** meldet.

### Wiederherstellen

1. Startseite → JSON-Sicherung importieren.  
2. Es entsteht eine Kopie der Prüfung in **diesem** Browser.  
3. Original-Excel-Pfade vom alten PC werden nicht benötigt – die relevanten Daten stecken in der JSON-Datei (inkl. Base64-HISinOne-Vorlagen, falls importiert).

---

## 10. Einstellungen und Darstellung

- **Einstellungen** der Prüfung: Metadaten, Typ, Teilgebiete (je nach Stand).  
- **Darstellung** (Header): Hell/Dunkel, **Schriftgröße** (Standard / Groß / Sehr groß, Zyklus-Button „A“), hoher Kontrast – lokal im Browser gespeichert.

---

## 11. Häufige Fragen

**Die Workflow-Schritte sind nicht alle grün, obwohl ich alles importiert habe.**  
Prüfen Sie offene Detailbewertungen und (bei THE/elektrP) die Matrikel-Zuordnung. „Exportbereit“ zählt nicht, solange Aufgaben offen sind.

**HISinOne-Export wird verweigert.**  
Oft fehlt die Originaldatei (erneut importieren) oder es gibt noch Orphans / offene Bewertungen.

**Download in Teams funktioniert nicht.**  
Dateidialog abwarten oder Banner am unteren Rand nutzen; alternativ im normalen Browser öffnen.

**Daten weg nach Browser-Wechsel / anderem PC.**  
Daten liegen nur im jeweiligen Browser. JSON-Sicherung importieren.

**Passwort vergessen.**  
Nur die Betreuung mit Zugriff auf Vercel-Env bzw. `.env.local` kann das Passwort neu setzen und die App neu bauen.

---

## 12. Verantwortungsvoller Umgang

- Prüfungsdaten sind personenbezogen – Gerät sperren, keine Screenshots in ungeschützte Kanäle.  
- JSON- und Excel-Exporte wie Notenlisten behandeln.  
- Die App speichert **nicht** in der Cloud der App selbst; Cloud-Sync des Browsers kann IndexedDB mitnehmen – auf geteilten Konten vorsichtig sein.
