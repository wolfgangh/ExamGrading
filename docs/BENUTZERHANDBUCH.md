# Benutzerhandbuch ExamGrade

Vollständige Anleitung für Prüferinnen und Prüfer – Einstieg und Nachschlagewerk.

**App-Version:** 0.4.74  
**Zielgruppe:** Personen, die Prüfungen bewerten und Noten an HISinOne bzw. die Studienabteilung melden  
**Datenschutz:** Alle Prüfungsdaten bleiben **im Browser** (IndexedDB). Es gibt **keine** Übertragung von Notenlisten an einen App-Server.

> **Keine Gewähr** für die Richtigkeit der Berechnungen. Ergebnisse vor dem Upload in HISinOne und vor der Weitergabe an Studierende prüfen.

---

## Inhaltsverzeichnis

1. [Einführung](#1-einführung)
2. [Zugang und Darstellung](#2-zugang-und-darstellung)
3. [Startseite](#3-startseite)
4. [Prüfungstypen im Überblick](#4-prüfungstypen-im-überblick)
5. [Navigation und Workflow](#5-navigation-und-workflow)
6. [Einstellungen](#6-einstellungen)
7. [Importe](#7-importe)
8. [Matrikel-Zuordnung (THE / elektrP)](#8-matrikel-zuordnung-the--elektrp)
9. [Punkte und Detailpunkte](#9-punkte-und-detailpunkte)
10. [Bewertung (StA und Portfolio)](#10-bewertung-sta-und-portfolio)
11. [Notenübersicht](#11-notenübersicht)
12. [Notenszenarien](#12-notenszenarien)
13. [Dokumente und Export](#13-dokumente-und-export)
14. [Sicherung und Wiederherstellung](#14-sicherung-und-wiederherstellung)
15. [Checklisten je Prüfungstyp](#15-checklisten-je-prüfungstyp)
16. [Häufige Fragen und Fehlerbehebung](#16-häufige-fragen-und-fehlerbehebung)
17. [Glossar](#17-glossar)
18. [Verantwortungsvoller Umgang](#18-verantwortungsvoller-umgang)

---

## 1. Einführung

### 1.1 Was ist ExamGrade?

ExamGrade unterstützt den Weg von der **HISinOne-Masterliste** über **Antritt und Bewertung** bis zum **formatgetreuen Notenexport** und internen Auswertungen (Notenspiegel, Szenarienvergleich, PDFs).

Typische Einsatzgebiete:

- Take-Home-Exams (THE) und elektronische Prüfungen (elektrP) mit Moodle
- Klassische Klausuren mit Punkteimport oder manueller Punktetabelle
- Studienarbeiten (Kriterienmatrix oder manuelle Note)
- Portfolioprüfungen mit Teilleistungen, optional Kriterien und mehreren Korrektoren
- Mehrere Studiengänge (mehrere HISinOne-Dateien) in **einer** Prüfung

### 1.2 Was ExamGrade **nicht** ist

- Kein HISinOne-Ersatz (Upload der Noten erfolgt weiter über das Campus-System)
- Keine Cloud-Notenverwaltung der App selbst
- Keine automatische rechtliche Finalisierung – **Sie** sind für die gemeldeten Noten verantwortlich

### 1.3 Lokale Datenhaltung

| Aspekt | Bedeutung |
|--------|-----------|
| Speicherort | Browser dieses Geräts (IndexedDB) |
| Server | Keine Noten-API; App kann statisch gehostet sein (z. B. Vercel) |
| Anderer Browser / PC | Daten **nicht** automatisch da – JSON-Sicherung importieren |
| Browser-Profil-Sync | Kann Daten mitnehmen – auf geteilten Konten vorsichtig sein |

---

## 2. Zugang und Darstellung

### 2.1 Anmeldung

1. App-URL öffnen.  
2. **App-Passwort** eingeben (von der Betreuung / aus der Umgebungskonfiguration).  
3. Session gilt für den Browser-Tab bzw. bis zum Schließen der Sitzung (sessionStorage).

Passwort vergessen: nur Personen mit Zugriff auf die Deployment-Umgebung (z. B. Vercel-Env) können es setzen und die App neu ausrollen.

### 2.2 Darstellung (Header)

| Einstellung | Wirkung |
|-------------|---------|
| Hell / Dunkel | Farbschema |
| Schriftgröße | Standard / Groß / Sehr groß (wirkt auf rem-basierte Texte, inkl. Matrix und TL-Nebenangaben) |
| Hoher Kontrast | verstärkte Kontraste |

Einstellungen werden **lokal im Browser** gespeichert.

### 2.3 Sidebar

In einer geöffneten Prüfung:

- Navigation zu den Bereichen (je nach Prüfungstyp unterschiedlich)
- **Workflow-Fortschritt** (erledigte / offene Schritte)
- Sidebar **ein-/ausklappbar** (Zustand wird gemerkt)

### 2.4 MS Teams

Die App kann als Website-Tab eingebettet werden. Downloads sind in Teams oft eingeschränkt; die App bietet dann Datei-Dialog oder manuellen Link. Bei Problemen: **Im Browser öffnen**.

---

## 3. Startseite

### 3.1 Prüfungskarten

Pro Prüfung sehen Sie u. a.:

- Name, Semester, Prüfungsform
- **Workflow-Status** (Fortschritt)
- Öffnen, ggf. Löschen

### 3.2 Neue Prüfung anlegen

Typische Felder:

- Name der Prüfung  
- Semester  
- Prüfungsnummer(n)  
- Dozentinnen/Dozenten (Liste / Freitext, Chips)  
- **Prüfungstyp** (entscheidet den gesamten weiteren Ablauf)  
- ggf. Teilgebiete und Punktemaxima (je nach Typ)

### 3.3 Sicherung von der Startseite

- **JSON importieren** (eine oder mehrere Dateien) bzw. **Semester-ZIP** – stellt Projekte in **diesem** Browser wieder her  
- **Semester sichern** – alle Prüfungen des aktuellen Semesters als ZIP  

Existiert die Prüfung bereits im Browser (gleiche Projekt-ID, oder Name + Semester + Form **und** gleiche nicht-leere Prüfungsnummer), öffnet sich ein **Konflikt-Dialog**:

1. Gegenüberstellung **Browser jetzt** vs. **Sicherung** (Änderungszeit mit Kennzeichnung „aktueller“, Zähler zu HIS, Punkten, Noten, …)  
2. **Als neue Version importieren** – zusätzliche Prüfung mit Namenszusatz `(Import …)` und Badge **Import-Kopie** auf der Karte  
3. **Bestehende ersetzen** – nur nach ausdrücklicher Bestätigung (Checkbox); die lokale Version wird überschrieben  
4. **Überspringen** bzw. bei mehreren Konflikten **Alle verbleibenden abbrechen**  
5. Esc / Dialog schließen bricht den restlichen Import ab (kein stilles Überspringen)  

Dateinamen der Sicherung typisch: Datum + Name + Schritt (z. B. `…_nach-Noten.json`), ohne Uhrzeit.

---

## 4. Prüfungstypen im Überblick

| Typ | Kurzbeschreibung | Typische Seiten |
|-----|------------------|-----------------|
| **THE** | Take-Home, Moodle-Antritt + Punkte | Import, Zuordnung, Punkte, Detailpunkte, Noten, Szenarien, Dokumente |
| **elektrP** | wie THE (Prüfung vor Ort) | wie THE |
| **Klausur** | HISinOne + Punkte (Vorlage/Import/manuell) | Import, Punkte, Detailpunkte, Noten, Szenarien, Dokumente |
| **StA – Kriterien** | Gewichtete Kriterien → Note | Import, **Kriterienbewertung**, Noten, ggf. Szenarien, Dokumente |
| **StA – manuell** | Note je Person manuell | Import, Notenübersicht, Dokumente |
| **Portfolio** | Teilleistungen, optional Kriterien & Korrektoren | Import, **Teilnoten**, Noten, ggf. Szenarien, Dokumente |
| **Sonstige** | flexibel | je nach Konfiguration |

**Gruppen** (StA / Portfolio): unter Einstellungen anlegen, in der Bewertungsmatrix zuordnen und filtern.

**Mehrere HISinOne-Quellen:** mehrere Studiengangs-Dateien in **einer** Prüfung; Export später **pro Datei/Studiengang**.

---

## 5. Navigation und Workflow

### 5.1 Sidebar-Einträge (je nach Typ)

| Eintrag | Inhalt |
|---------|--------|
| Übersicht | Status, nächste Schritte, Kennzahlen |
| Importe | HISinOne, Antritt, Punkte, manuell Personen |
| Zuordnung | nur THE/elektrP – Orphans |
| Punkteerfassung / Detailpunkte | Klausur, THE, elektrP |
| Kriterienbewertung / Teilnoten | StA-Kriterien bzw. Portfolio |
| Notenübersicht | Tabelle, Filter, Overrides, Szenario-Umschalter |
| Notenszenarien | Bestehensgrenzen, Vergleich – nur wenn Punkte/Prozent in die Note eingehen |
| Dokumente | PDFs, HISinOne-Excel, Notenspiegel |
| Sicherung | JSON-Download / Status |
| Einstellungen | Metadaten, Struktur, Gruppen, Dozenten |

Auf schmalen Bildschirmen ist die Sidebar ein Overlay (Menü-Symbol oben links).

### 5.2 Workflow-Schritte (Beispiele)

**THE / elektrP:** HISinOne → Antritt → Zuordnung → Punkte/Bewertung → Noten → Sicherung nach Noten → Dokumente  

**Klausur:** HISinOne → Punkte → Noten → Sicherung → Dokumente  

**StA / Portfolio:** HISinOne → Struktur (Einstellungen) → Bewertung → Noten → Sicherung → Dokumente  

Meilensteine u. a.:

- **Sicherung nach Import**  
- **Sicherung nach Noten** (vor geschütztem Export empfohlen/erforderlich)

### 5.3 Wann ist etwas gesperrt?

| Sperre | Typische Ursache |
|--------|------------------|
| Notenschlüssel / Szenario-Wechsel | Offene Aufgaben „Bewertung notwendig“ (Moodle-Detail) |
| Teilnoten / Noten-Workflow (Portfolio) | Unvollständige Kriterien bei **angetretenen** Personen |
| Export / PDFs | Offene Bewertungen; ungeprüfte Orphans (THE); **veraltete oder fehlende JSON-Sicherung**; Validierungsfehler (z. B. unvollständige Teilnoten, fehlende HIS-Originalvorlage) |
| HISinOne-Excel | Fehlende Original-.xlsx-Vorlage (erneut importieren) |

**No-Show / „Nicht angetreten“** (Portfolio/StA): markierte Personen brauchen **keine** Teilnoten und blockieren den Workflow nicht; im HISinOne-Export erscheint i. d. R. **keine Note**.

---

## 6. Einstellungen

Seite: **Einstellungen**.

### 6.1 Metadaten

- Name, Semester, Prüfungsnummer  
- Dozentinnen/Dozenten (mehrere möglich – erscheinen in PDFs und Exporten)  

### 6.2 Struktur je Typ

| Typ | Typische Einstellungen |
|-----|------------------------|
| Klausur / THE | Teilgebiete, Maxima, Notenschema indirekt über Szenarien |
| StA-Kriterien | Kriterienliste: Name, Code, Gewicht, Skala (%, Punkte, Note), Beschreibung |
| Portfolio | Teilleistungen (Code, Name, Gewicht); optional **Kriterienmodus**; optional **Teilnoten je Dozent** |
| Gruppen | Anlegen, umbenennen, Reihenfolge; in der Matrix zuordnen |

### 6.3 Portfolio: Kriterien und Korrektoren

- **Kriterienmodus:** je Teilleistung einheitliche Skala (Punkte / Prozent / Note) und Kriterien mit Gewicht und Maxima (bei Punkten z. B. 0–6).  
- **Pro Dozent bewerten:** jeder Korrektor füllt die Matrix; Teilnote = Mittel der Dozenten.  
- **Kriterien pro Gruppe deaktivieren:** unter Gruppensteuerung – deaktivierte Kriterien zählen nicht in die Note dieser Gruppe.

### 6.4 Notenszenarien (Voreinstellung)

Die **aktive** Bestehensgrenze steuert die Noten bei punkte-/prozentbasierten Pfaden. Details: [§12 Notenszenarien](#12-notenszenarien).

---

## 7. Importe

Seite: **Importe**.

### 7.1 HISinOne (Masterliste / Noteneintrag)

- Offizielle Excel-Vorlage(n) aus HISinOne  
- **Mehrere Dateien** möglich (verschiedene Studiengänge) – werden als getrennte Quellen geführt  
- Gleiche Prüfungsnummer, andere Datei: Nachfrage (zusätzlich behalten oder ersetzen), kein stilles Überschreiben  
- Die **Originaldatei** wird für den formatgetreuen Re-Export mitgespeichert   

### 7.2 Antritt (THE / elektrP)

- Moodle-Antrittsliste  
- Fehlende Matrikelnummern in HISinOne → **Zuordnung**  

### 7.3 Punkte

- Moodle-Punkte / Bewertungsexcel oder Klausur-Vorlage  
- Offene manuelle Aufgaben später unter Detailpunkte schließen  

### 7.4 Manuell Personen (StA / Portfolio)

Personen ohne HIS-Import hinzufügen – Export über HISinOne nur, wenn sie in der Masterliste sind; sonst manuelle Notenmeldung-PDF.

### 7.5 Größenlimits

| Typ | ca. Maximum |
|-----|-------------|
| Excel | 15 MB |
| JSON-Sicherung | 50 MB |

Mini-Beispiele: [`sample/`](../sample/).

---

## 8. Matrikel-Zuordnung (THE / elektrP)

Seite: **Zuordnung**.

Wenn Antritt oder Punkte eine Matrikelnummer enthalten, die **nicht** in HISinOne vorkommt (**Orphan**):

1. Vorschläge prüfen (Ähnlichkeit Name/Matrikel).  
2. **Zusammenführen** (mit Begründung) **oder ablehnen**.  
3. Ggf. Sammelablehnung.  
4. Merges und Ablehnungen sind dokumentiert und **rückgängig** machbar.

Solange Orphans ungeprüft sind, bleiben Notenliste und HISinOne-Export **gesperrt**.

---

## 9. Punkte und Detailpunkte

(Für Klausur, THE, elektrP – nicht primär StA manuell.)

| Seite | Nutzen |
|-------|--------|
| **Punkteerfassung** | Übersicht / manuelle Gesamtpunkte |
| **Detailpunkte** | Aufgabenweise Werte, „Bewertung notwendig“ abschließen |
| Teilgebiet-Mapping | Fragen den Teilgebieten zuordnen (falls genutzt) |

**„Bewertung notwendig“:** blockiert den Notenschlüssel und den Export, bis alle betroffenen Aufgaben erledigt sind.

---

## 10. Bewertung (StA und Portfolio)

Seite: **Kriterienbewertung** bzw. **Teilnoten**.

### 10.1 Bewertungsmatrix

- Zeilen: Studierende  
- Spalten: Kriterien (StA) bzw. Kriterien je Teilleistung (Portfolio) und berechnete **Teilnote**  
- **Tab** springt zum nächsten Kriterium; Name kann zur Person verlinken (Notenübersicht → Matrix)  
- Horizontales Scrollen per Pfeile (wenn viele Spalten)  

### 10.2 Anzeige unter der Teilnote (Portfolio)

- Erfüllung in % und ggf. Rohpunkte-Summe (z. B. `19,6/24 · 82 %`)  
- Chip **Abstand zur nächsten Teilnote** (besser ↑ / schlechter ↓)  

### 10.3 Gruppen

- Zuordnung pro Person (Dropdown)  
- Filterleiste: Gruppe wählen, Sammelzuordnung, Füllstand der Gruppe  
- Personen **ohne Gruppe** sind hervorgehoben  
- Optional: Kriterien einer Gruppe deaktivieren  

### 10.4 Dozenten / Korrektoren (Portfolio)

Wenn „Teilnoten je Dozent“ aktiv: Bewerter wählen; jede Person braucht vollständige Werte **aller** Korrektoren für die Teilnote.

Weichen die Korrektoren einer Teilleistung um **mehr als 0,7 Notenstufen** voneinander ab, erscheint ein Hinweis in der Matrix und in der Notenübersicht.

### 10.5 Nicht angetreten (No-Show)

Für HISinOne-angemeldete Personen, die **nicht** bewertet werden (z. B. ohne Gruppe, nicht erschienen):

| Ort | Aktion |
|-----|--------|
| Matrix | Button **„Nicht angetreten“** (orange, mit Icon) |
| Notenübersicht | Note klicken → Dialog: als nicht angetreten markieren |

**Wirkung:**

- Status **No-Show**  
- Keine Teilnoten erforderlich  
- Workflow und Export-Validierung werten die Person als erledigt  
- HISinOne-Export: leere Note  

**Sichtbar**, wenn: ohne Gruppe **oder** noch keine Werte **oder** bereits No-Show (zum Aufheben).  
**Ausgeblendet**, wenn: Person hat eine Gruppe **und** bereits Noten/Punkte/% eingetragen.

**Antritt markieren** hebt die Markierung wieder auf.

Ohne importierte Antrittsliste (StA/Portfolio) zählen manuelle No-Shows trotzdem in Kennzahlen und Quote.

### 10.6 Schriftgröße

Matrix- und Tabellentexte skalieren mit der Appearance-Schriftgröße (Standard / Groß / Sehr groß).

### 10.7 Generative KI und Kriterien

KI-Werkzeuge (ChatGPT, Copilot u. Ä.) sind in der Regel zulässig, sofern Prüfungsordnung oder Aufgabenstellung nichts anderes vorgeben. Die Bewertung darf sich **nicht** auf Stil, Sprache oder Formalia allein stützen – ein Modell erzeugt diese zuverlässig.

**Standardkatalog Studienarbeit** (wird bei neuen StA-Kriterienprüfungen angelegt; unter Einstellungen nachladbar):

| Kürzel | Kriterium | Gewicht | Warum prüfbar |
|--------|-----------|---------|----------------|
| ABZ | Aufgabenbezug und Fragestellung | 2 | Konkrete Aufgabenstellung getroffen? |
| FACH | Fachliche Korrektheit | 3 | Rechnung, Code oder Begriff stichproben |
| METH | Methode und Begründung | 2 | Warum dieses Vorgehen, welche Grenzen? |
| QUEL | Quellen und Belege | 2 | Drei zentrale Belege prüfen |
| SPEZ | Spezifität statt Generik | 2 | Eigene Daten/Fall/Zahlen, keine Lehrbuchphrasen |
| REPR | Reproduzierbarkeit | 2 | Workflow/Notebook **ausführen**, nicht nur lesen |

Einheitliche Skala **Punkte 0–6** mit Stufen in der Beschreibung (6 / 3 / 0). Kolloquium und Individualbeitrag nur anlegen, wenn mündlich bzw. gruppenindividuell bewertet wird.

**Quellenstichprobe:** drei zentrale Belege (DOI, Seitenzahl, Inhalt). Tote oder erfundene Quellen → niedriger Wert bei QUEL.

**Nicht als alleiniges Kriterium:** Sprache/Form; holistisches „Inhalt“ ohne Anker; Prozent ohne Stufen.

**Portfolio-Standard:** Teilleistung **Arbeitsergebnis** (ABZ, FACH, SPEZ) und **Nachvollziehbarkeit** (METH, QUEL, REPR). Kriterienmodus unter Einstellungen aktivieren.

Kriterien und Beschreibungen sind jederzeit anpassbar.

### 10.8 Restliste in der Matrix

Die Bewertungsmatrix zeigt **Noch n von m** für Personen in HISinOne ohne Note (No-Shows zählen als erledigt). Die Restliste listet auch Personen, die hinter Filter oder Suche verborgen sind – ein Klick setzt die Ansicht zurück und springt zur Zeile.

---

## 11. Notenübersicht

Seite: **Notenübersicht**.

### 11.1 Tabelle

Typische Spalten:

- Matrikel, Name, **Studiengang**, Status, Antritt  
- **Gruppe** (bei StA/Portfolio mit Gruppen)  
- Punkte, %, Note  
- Portfolio: **Teilnoten** je TL mit %/Punkten und Abstand zur nächsten TL-Note  
- „bis nächste Note“ (Gesamt)  
- Filterbare und sortierbare Ansicht  

Name kann zur **Bewertungsmatrix** der Person springen (Deep-Link).

### 11.2 Filter und Markierungen

| Filter | Bedeutung |
|--------|-----------|
| Suche | Name / Matrikel |
| Status | z. B. exportbereit, No-Show |
| **Studiengang** | Programmkürzel (bei mehreren HIS-Quellen); „Ohne Studiengang“ |
| Note | Mehrfachauswahl |
| Gruppe | über Gruppenleiste (StA/Portfolio) |
| Grenzfall | Abstand zur nächsten Note ≤ Schwelle (Punkte oder Notengrade, je nach Kontext) |
| Nur Durchfaller / No-Shows / Antritt ohne HIS | Checkboxen |

Zeilenfarben u. a. Grenzfall (amber), Durchfaller (rose), No-Show.

### 11.3 Note manuell überschreiben

- Note in der Tabelle anklicken  
- Override setzen, Kommentar  
- Override entfernen  
- Bei StA/Portfolio: **Nicht angetreten** im Dialog  

### 11.4 Aktives Notenszenario

Umschalter / Link zu den Szenarien: das **aktive** Szenario steuert die Noten bei punkte-/prozentbasierten Portfolio- und Klausur-Schlüsseln.

### 11.5 Durchfaller-Analyse

- Nav-Link **Durchfaller** bzw. Kennzahl-Kachel  
- Abschnitt mit Anzahl, Ø Punkte, Nähe zur Bestehensgrenze, Liste  
- Details ein-/ausklappbar; Anker `#durchfaller` öffnet den Bereich  

### 11.6 Punkte-Anzeige bei Portfolio mit Punkte-Kriterien

Bei **reinen Punkte-Kriterien** (z. B. 11 × max. 6 → Max. 66):

- Spalte **Punkte** = **echte Rohpunktesumme**, nicht „Erfüllung × 100“  
- % = Rohpunkte / Max  
- Interne Notenfindung kann weiter über eine 0–100-Skala laufen; Anzeige und PDF-Header nutzen die echten Maxima  

---

## 12. Notenszenarien

Seite: **Notenszenarien** (nicht bei StA manuell; Portfolio wenn Punkte/Prozent-TLs).

### 12.1 Was steuert das Szenario?

| Kontext | Wirkung |
|---------|---------|
| Klausur / THE / Punkte | Punkte → Note über Schwellen des aktiven Schemas |
| Portfolio Punkte/Prozent | Erfüllung (unit) × Schema-Max → `calculateGrade` mit aktivem Schema |
| Portfolio reine Note-TLs | linear 5−4·unit, **unabhängig** vom Szenario |

### 12.2 Portfolio-Presets

Typisch:

- **50 % Bestehen** (Standard)  
- **40 % Bestehen**  
- **Frei** (Bestehens-% einstellbar)  
- optional **Eigene Grenzen** (Schwellen je Note)  

Anzeige der Schwellen dual in **% und Punkten** (bezogen auf das Anzeige-Max der Prüfung).

### 12.3 Direktvergleich und Impact

- Kennzahlen je Szenario (Ø Note, Median, Bestehen %, Durchfaller, Grenzfälle)  
- Auswirkung des Wechsels (besser/schlechter/neu bestanden)  
- Notenstufen und Einzelnoten (Tabelle / Chart)  
- Durchfaller über Szenarien  
- **PDF-Export** des Vergleichs  

Diagramme: vergrößern, PNG speichern.

### 12.4 Grenzfälle

- Markierung, wenn der Abstand zur nächsten Note klein ist  
- Defaults: z. B. ≤ 2 Punkte (bei Max 100 Schema) bzw. ≤ 0,1 Notengrade  
- In der Notenübersicht einstellbar  

---

## 13. Dokumente und Export

Seite: **Dokumente** (geschützte Exporte erfordern i. d. R. aktuelle **JSON-Sicherung**).

### 13.1 Notenliste PDF

- Alle Teilnehmenden inkl. No-Shows  
- **Teilnoten** je Teilleistung in der Haupttabelle  
- Optional: Checkbox **„Rohwerte der Teilkriterien anhängen“** → zusätzliche Tabelle(n), bei vielen Kriterien in **Abschnitten** (kein horizontaler Überlauf)  
- Unterschriftenblock, dokumentierte Matrikel-Merges  
- Footer: Prüfung, Prüfungsnummer, Seitenzahl  

### 13.2 HISinOne-Excel

- Formatgetreu aus der **importierten Originalvorlage** (nur Notenspalte)  
- **Eine Datei pro importierter HIS-Quelle / Studiengang**  
- Bei mehreren Quellen:  
  - deutlicher Hinweis „N separate Dateien“  
  - **eigener Button pro Studiengang** (Kürzel, Prüfungsnummer, Anmeldezahlen, Dateiname)  
  - optional „Alle N Dateien nacheinander“  

### 13.3 Weitere Exporte

| Export | Verwendung |
|--------|------------|
| Manuelle Notenmeldung PDF | Personen ohne HIS / Sonderfälle |
| Durchfaller / Zweitkorrektur PDF | Zweitkorrektur dokumentieren |
| Notenänderungen PDF | Korrekturen nach Einsicht |
| Notenspiegel PDF/Excel | aggregiert, ohne Personenliste |
| Szenarienvergleich PDF | von der Szenarien-Seite |

### 13.4 Wann Export gesperrt ist

Prüfen Sie die Hinweise auf der Dokumente-Seite:

1. **Sicherung veraltet / fehlt** → unter **Sicherung** JSON speichern  
2. Offene „Bewertung notwendig“  
3. Ungeprüfte Orphans (THE/elektrP)  
4. Validierung: z. B. Teilnoten unvollständig bei **angetretenen** Personen (No-Shows zählen nicht)  
5. Fehlende HIS-Originalvorlage → Import wiederholen  

---

## 14. Sicherung und Wiederherstellung

### 14.1 Sichern

- Seite **Sicherung** oder Workflow-Meilensteine  
- Nach Import und nach finalen Noten empfohlen  
- **Semester-ZIP** von der Startseite  

Nach Änderungen meldet die App ggf. **„Sicherung veraltet“** – dann erneut sichern, sonst bleiben PDFs/HIS-Export gesperrt.

### 14.2 Wiederherstellen

1. Startseite → JSON und/oder Semester-ZIP importieren  
2. **Neue** Prüfungen (noch nicht im Browser): werden als neues Projekt angelegt  
3. **Bereits vorhandene** Prüfungen: Konflikt-Dialog (neue Version / ersetzen / überspringen) – siehe [§3.3](#33-sicherung-von-der-startseite)  
4. Auf einem neuen PC (leerer Browser): Import legt die Projekte ohne Konflikt an  


---

## 15. Checklisten je Prüfungstyp

### 15.1 THE / elektrP

- [ ] HISinOne importiert (alle Studiengänge)  
- [ ] Antritt importiert  
- [ ] Orphans erledigt  
- [ ] Punkte importiert, offene Aufgaben geschlossen  
- [ ] Noten / Szenario geprüft  
- [ ] JSON-Sicherung (nach Noten)  
- [ ] HIS-Excel **pro Studiengang** + gewünschte PDFs  

### 15.2 Klausur

- [ ] HISinOne  
- [ ] Punkte vollständig  
- [ ] Noten / Szenario  
- [ ] Sicherung  
- [ ] Export  

### 15.3 Portfolio / StA-Kriterien

- [ ] HISinOne (+ manuell Personen falls nötig)  
- [ ] Teilleistungen / Kriterien / Gruppen / Dozenten in den Einstellungen  
- [ ] Matrix vollständig **oder** No-Show markiert  
- [ ] Notenübersicht und Szenario (falls Punkte/Prozent)  
- [ ] Sicherung  
- [ ] Dokumente: Notenliste, HIS-Excel je Studiengang, ggf. Notenspiegel  

### 15.4 StA manuell

- [ ] HISinOne  
- [ ] Note je Person  
- [ ] Sicherung  
- [ ] Export  

---

## 16. Häufige Fragen und Fehlerbehebung

**Workflow „Teilnoten“ bleibt offen, obwohl fast alle fertig sind.**  
Eine Person ohne Note und ohne No-Show-Markierung reicht. → Nicht angetreten markieren oder bewerten.

**Dokumente gesperrt, obwohl Noten da sind und eine No-Show markiert ist.**  
1) JSON-Sicherung aktuell? 2) Andere Personen noch unvollständig? 3) HIS-Originalvorlage vorhanden?

**PDF zeigt 50 von 100 Punkten, obwohl max. 66 Kriterienpunkte.**  
Ab Version 0.4.49: bei reinen Punkte-Kriterien Anzeige und PDF-Header in echten Punkten. Hard-Reload der App prüfen.

**Notenliste zeigt „75 Punkte“ statt Rohsumme.**  
Siehe oben – echte Rohpunkte bei Punkte-Kriterien; sonst Erfüllungsskala 0–100.

**Szenario 40 % / 50 % / 60 % ändert die Noten nicht.**  
Nur bei Punkte/Prozent-TLs im Kriterienmodus. Reine Note-TLs sind linear und szenario-unabhängig.

**HISinOne-Export: nur eine Datei erwartet, aber mehrere Buttons.**  
Pro importierter HIS-Datei ein Export – jeweils in HISinOne hochladen.

**Download in Teams klappt nicht.**  
Dateidialog / Banner; besser im normalen Browser.

**Daten nach Browserwechsel weg.**  
JSON-Sicherung importieren.

**Schrift in der Matrix/Notenliste zu klein.**  
Header → Schriftgröße „Groß“ oder „Sehr groß“.

---

## 17. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **HISinOne** | Campus-Management; Noteneintrag über Excel-Vorlage |
| **Orphan** | Antritt/Punkte-Matrikel ohne Treffer in HISinOne |
| **Teilleistung (TL)** | Bestandteil einer Portfolioprüfung |
| **Teilkriterium** | Einzelkriterium innerhalb einer TL oder StA |
| **Unit / Erfüllung** | Normierte Leistung 0…1 (bzw. %) |
| **Notenszenario** | Bestehensgrenze und Schwellen für den Notenschlüssel |
| **No-Show / nicht angetreten** | Angemeldet, aber nicht bewertet; leere Note im Export |
| **Override** | Manuell gesetzte Note statt berechneter Note |
| **JSON-Sicherung** | Vollständiger lokaler Projektstand zum Download |
| **Grenzfall** | Knapp vor der nächsten Notenstufe |

---

## 18. Verantwortungsvoller Umgang

- Prüfungsdaten sind personenbezogen: Gerät sperren, Exporte wie Notenlisten behandeln.  
- Keine ungeschützten Screenshots in Messenger-Gruppen.  
- Vor dem Upload: Stichproben (Punkte, Teilnoten, No-Shows, Studiengänge).  
- Die App speichert **nicht** in einer App-Cloud; trotzdem JSON-Backups extern ablegen.

---

## Siehe auch

| Dokument | Inhalt |
|----------|--------|
| [README.md](../README.md) | Projektüberblick, Schnellstart |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Passwort, Teams |
| [ARCHITEKTUR.md](ARCHITEKTUR.md) | Technik (für Entwickler) |
| [SECURITY.md](../SECURITY.md) | Sicherheit und Betrieb |

---

*ExamGrade · OTH Regensburg · Dokumentation Stand App v0.4.53*
