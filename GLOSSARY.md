# ExamGrade – Notenbildung

Begriffe, mit denen ExamGrade aus Bewertungen eine Prüfungsnote bildet (Klausur, THE/elektrP, Studienarbeit, Portfolio), nach RaPO Bayern und APO der OTH Regensburg.

## Language

### Teilnehmende

**Teilnehmerliste**:
Alle zu einer Prüfung angemeldeten Personen, gebildet aus den HISinOne-Dateien und der manuellen Teilnehmerliste.
_Avoid_: Masterliste, HIS-Liste

**HISinOne-Datei**:
Aus HISinOne exportierte Noteneintrags-Vorlage eines Studiengangs; Quelle und Ziel des formatgetreuen Notenexports.
_Avoid_: HIS-Quelle, QIS-Liste

**Manuelle Teilnehmerliste**:
In ExamGrade erfasste Teilnehmende ohne HISinOne-Datei; Notenmeldung über die Excel-Notenliste.
_Avoid_: Extras, manuelle Personen

### Bewertung

**Teilleistung (TL)**:
Gewichteter Bestandteil einer Portfolioprüfung mit eigener Teilnote.
_Avoid_: Komponente, Teilprüfung

**Kriterium**:
Einzeln bewerteter Aspekt einer Studienarbeit oder Teilleistung mit Gewicht und genau einer Skala (Punkte, Prozent oder Note).
_Avoid_: Teilkriterium, Merkmal

**Erfüllung**:
Gewichteter Anteil der erreichten an den erreichbaren Kriterienwerten, 0–100 %.
_Avoid_: Unit, Fulfillment, Erfüllungsgrad

### Noten

**Notenstufe**:
Zulässiger Notenwert 1,0 · 1,3 · 1,7 · 2,0 · 2,3 · 2,7 · 3,0 · 3,3 · 3,7 · 4,0 · 5,0.
_Avoid_: Notengrad, Note (für Zwischenwerte)

**Teilnote**:
Notenstufe einer Teilleistung; bei mehreren Korrektoren deren Notenmittel, auf eine Notenstufe gebracht.
_Avoid_: TL-Note, Komponentennote

**Notenmittel**:
Ungerundeter gewichteter Durchschnitt mehrerer Noten (Teilnoten, Note-Kriterien oder Korrektorennoten). Es wird auf eine Notenstufe gebracht, indem nach der ersten Dezimalstelle abgeschnitten wird; über 4,0 ergibt 5,0, sonst die nächste Notenstufe (bei Gleichstand die bessere).
_Avoid_: Rohmittel, Rohnote, Durchschnittsnote

**Gesamtnote (Portfolio)**:
Das gewichtete Notenmittel der Teilnoten, auf eine Notenstufe gebracht.
_Avoid_: Endnote, Portfolionote

**Ausgleich**:
Eine nicht bestandene Teilnote (5,0) kann durch andere Teilleistungen ausgeglichen werden; je Prüfung einstellbar.
_Avoid_: Kompensation

**Notenszenario**:
Bestehensgrenze mit daraus abgeleitetem Notenschlüssel, der Punkte oder Erfüllung auf Notenstufen abbildet.
_Avoid_: Schema, Szenario-Schlüssel

**Grenzfall**:
Bewertung, die knapp unter der nächstbesseren Notenstufe liegt, gemessen in derselben Größe, aus der die Note entsteht.
_Avoid_: Borderline, Wackelkandidat
