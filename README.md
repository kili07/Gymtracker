# Gymtracker

Trainingslogger fürs Handy: Sätze, Wiederholungen und Gewicht während des Trainings erfassen, Pause messen, Fortschritt je Übung sehen. Läuft als installierbare Web-App (PWA) offline auf dem Handy, ohne Konto und ohne Server — alle Daten bleiben auf dem Gerät.

## Was die App kann

**Heute** — Training starten, beim ersten Training des Tages kurz das Körpergewicht eintragen (oder überspringen), Übung wählen (Suche, zuletzt genutzte oben, darunter alle nach Muskelgruppe, neue Übung direkt anlegen), Satz für Satz loggen. Oben steht groß die Kalenderwoche mit der Zahl der Trainings, darunter das letzte Training mit dem besten Satz je Übung; bei Langhantel-Übungen zeigt eine kleine Hantel die Scheiben je Seite (einstellbar je Übung). Wiederholungen und Gewicht stehen vom letzten Mal schon im Formular, passende Wiederholungszahlen lassen sich direkt antippen, Gewicht lässt sich in Schritten von 1, 1,25, 2,5 oder 5 kg ändern oder frei eintippen. Zu jeder Einheit gehören eine Notiz und Markierungen (Sauna, Cardio, Dehnen).

**Pause** — Nach jedem gespeicherten Satz läuft die Pause automatisch, standardmäßig 1:30. Die Leiste über der Tableiste zeigt die Restzeit, ±15 s und Überspringen. Gespeichert wird die Endzeit, nicht die Restzeit: Die Pause läuft deshalb richtig weiter, wenn der Bildschirm ausgeht oder die App im Hintergrund liegt. Am Ende vibriert das Handy und — wenn erlaubt — kommt eine Benachrichtigung. Während eines Trainings hält die App den Bildschirm wach.

**Verlauf** — Körpergewicht mit Verlauf, aktuellem Wert und Änderung in 30 Tagen (Einträge nachtragen, ändern, löschen), Sätze je Woche als Balken, Kennwerte der letzten 30 Tage, darunter alle Trainings. Ein Tipp öffnet die Einheit: Sätze ändern oder nachtragen, Übung entfernen, Notiz, Datum, Training löschen.

**Übungen** — Alle Übungen nach Muskelgruppe, mit dem letzten Wert und einer kleinen Verlaufslinie. Ein Tipp öffnet die Übung mit Bestwerten und Diagrammen über 3 Monate, 1 Jahr oder alles:

| Übungstyp | Diagramme |
|---|---|
| Gewicht (Hantel, Maschine) | Höchstgewicht, geschätztes 1RM nach Epley, Volumen je Training |
| Körpergewicht (z. B. Klimmzüge, optional mit Zusatzgewicht) | meiste Wiederholungen, Wiederholungen je Training |
| Zeit (z. B. Deadhang) | längste Dauer, Zeit je Training |

Unter jedem Diagramm steht ein Satz zur Einordnung: Mittel im Zeitraum gegen den Zeitraum davor. Antippen oder Ziehen im Diagramm liest den einzelnen Wert ab.

**Einstellungen** — Pausenzeit, Schrittweite fürs Gewicht, Übungen verwalten (anlegen, umbenennen, archivieren, löschen), hell/dunkel, Benachrichtigung erlauben, Backup, alte Trainings hinzufügen, Installieren, Version.

Als Startliste sind die bisher genutzten Übungen angelegt: Bizeps, Bankdrücken frei und geführt, Cross Butterfly (Kabelturm), Butterfly, Schulter, Bauch, Klimmzüge, ISO Lateral Row, Deadhang.

## Installieren

1. `https://<name>.github.io/gymtracker/` in Chrome auf dem Handy öffnen.
2. Einstellungen → **App installieren**. Der Knopf erscheint eventuell erst nach ein paar Sekunden.
3. Ersatzweise ⋮ → „App installieren" — nie „Verknüpfung erstellen", die öffnet sich immer als Tab mit Adressleiste.

Danach startet die App vom Homescreen, läuft offline und aktualisiert sich beim Öffnen selbst, sobald eine neue Fassung hochgeladen ist.

## Daten und Backup

Alles liegt in `localStorage` unter `gym.v1`, nur auf diesem Gerät. **„Browserdaten löschen" entfernt die Daten ohne Vorwarnung**, deshalb regelmäßig Einstellungen → Backup speichern. Die Datei (`gymtracker-JJJJ-MM-TT.json`) enthält Übungen, Trainings und Einstellungen und lässt sich über „Backup laden" auf jedem Gerät wieder einspielen; dabei werden die vorhandenen Daten ersetzt. „Alte Trainings hinzufügen" liest dagegen eine Import-Datei (`meta.kind: "gym-merge"`) und fügt deren Trainings zu den vorhandenen hinzu.

## Entwicklung

Kein Build, keine Abhängigkeiten, kein Netzwerk. Lokal starten:

```
python3 -m http.server 8123      # dann http://localhost:8123/
node tests/core-test.js          # Rechenlogik prüfen
node tests/daten.js --ls         # Jahresdatensatz für die Ansicht erzeugen
python3 icons/make-icons.py      # Icons neu zeichnen (braucht Pillow)
```

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst, vier Tabs, Sheet, Pausenleiste |
| `core.js` | Datenmodell und Auswertung ohne DOM (Epley, Volumen, Serien, Bestwerte, Wochen) |
| `app.js` | Ansichten, Sheets, Pausentimer, Backup, Service-Worker-Anbindung |
| `charts.js` | Diagramme als inline-SVG (Linie, Balken, Sparkline) |
| `tokens.css` / `style.css` | Farben und Maße / Bausteine |
| `tests/`, `tools/` | Node-Tests und Prüf-Schnipsel, werden nicht hochgeladen |

Regeln und Bau-Reihenfolge stehen im Skill `web-app`, Projektspezifisches in `CLAUDE.md`, Entscheidungen und offene Punkte in `DECISIONS.md`.
