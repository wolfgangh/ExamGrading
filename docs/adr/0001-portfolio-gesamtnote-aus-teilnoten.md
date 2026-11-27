# 0001 – Portfolio-Gesamtnote aus Teilnoten, Notenmittel nach RaPO

**Status:** angenommen (v0.4.75, 2026-11-27)

## Kontext

Für die Portfolio-Gesamtnote standen zwei Formeln nebeneinander. Laut Doku galt: gewichtete Erfüllung über alle Teilleistungen × Notenschlüssel. Der Code bildete dagegen das gewichtete Mittel der Teilnoten. „Bis nächste Note“, Grenzfall und „Punkte unter Bestehen“ rechneten mit der ersten Formel, die Note mit der zweiten. Dadurch konnte eine Person die Note 4,0 haben und gleichzeitig „unter der Bestehensgrenze“ liegen. Außerdem wurden Notenmittel erst ab 4,5 als nicht bestanden gewertet (4,2 → 4,0), und Korrektorenmittel gingen ungerundet ein.

## Entscheidung

- **Gesamtnote = gewichtetes Notenmittel der Teilnoten.** Jede Teilnote ist eine Notenstufe. Bei Punkte- oder Prozent-Kriterien entsteht sie über das aktive Notenszenario, bei Note-Kriterien linear; bei mehreren Korrektoren ist sie deren Mittel als Notenstufe.
- **Notenmittel → Notenstufe nach RaPO Bayern / APO OTH:** nach der ersten Dezimalstelle abschneiden, über 4,0 → 5,0, sonst nächste Stufe (bei Gleichstand die bessere). Das gilt auch für StA mit reinen Note-Kriterien.
- **Ausgleich** einer Teilnote 5,0 ist je Prüfung einstellbar, Standard „erlaubt“.
- Alle abgeleiteten Anzeigen (bis nächste Note, Grenzfall, Abstand zur 4,0) nutzen dieselbe Formel wie die Note.
- Altprojekte: einmaliger Hinweis mit der Liste alt → neu (Regelversion am Projekt), keine stille Migration.

## Alternativen

- *Gesamterfüllung × Schema*: eine einzige Rundung und szenarioabhängig, aber die Teilnoten wären dann für Studierende nicht nachvollziehbar, und das entspricht nicht der üblichen Modulbeschreibung „Gewichtung der Teilleistungen“. Abgelehnt.
- *Nächste Stufe ohne Abschneiden*: einfacher, widerspricht aber der RaPO/APO. Abgelehnt.

## Folgen

Noten in bestehenden Portfolio- und StA-Projekten können sich ändern, etwa 4,2 → 5,0 oder 2,16 → 2,0 statt 2,3. Die alte Regel bleibt als Regelversion 1 nur für den Vergleich erhalten (`runWithGradeRules`).
