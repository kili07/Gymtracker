# Entscheidungen und offene Punkte

## Entscheidungen
03.11.2026, aus der Projektnotiz übernommen und beim Bauen bestätigt:

- **Eigene PWA, keine Unterseite im Life-Dashboard.** Das Dashboard blendet den Gymtracker nur als Kachel ein. So bleibt der Logger im Studio in einem Griff erreichbar und teilt sich keinen Zustand mit dem Dashboard.
- **Alte Trainingsnotizen über eine Import-Datei, nicht über einen Parser** (geändert 04.11.2026; vorher: kein Import). Die Notizen aus der Notizen-App sind unregelmäßig formatiert, deshalb werden sie einmalig von Hand in eine JSON-Datei mit `meta.kind: "gym-merge"` übertragen (nur Sätze mit Gewicht und Wiederholungen, dazu Deadhang-Zeiten). „Alte Trainings hinzufügen" in den Einstellungen fügt sie dazu, ohne etwas zu ersetzen: Übungen werden über den Namen gefunden, Tage mit vorhandenem Training übersprungen (`Core.planMerge`). Die Datei mit den eigenen Trainings liegt nicht im Repo, weil es öffentlich ist. Die Startliste in `SEED` (`core.js`) bleibt mit festen, sprechenden ids.
- **Kein Trainingsplan, keine Routinen.** Training läuft frei je nach Tag. „Heute" beginnt deshalb mit einer leeren Einheit und der Übungsauswahl, nicht mit einem Plan.
- **Kein Backend, kein Sync.** Daten liegen in `localStorage` unter dem einen Schlüssel `gym.v1`. Austausch zwischen Geräten läuft über Backup-Export und -Import, nicht über einen Server.
- **Pausentimer speichert die Endzeit als Zeitstempel** (`db.rest = { endsAt, total }`), er zählt nichts herunter. Ein Countdown in einer Variablen steht still, sobald der Bildschirm ausgeht oder die App in den Hintergrund wandert; aus der Endzeit lässt sich die Restzeit nach dem Aufwachen einfach neu ausrechnen.
- **Drei Übungstypen statt eines Satzschemas:** `weight` (Wdh und kg), `bodyweight` (Wdh, optional Zusatzgewicht) und `time` (Sekunden). Klimmzüge und Deadhang passen sonst in kein sinnvolles Feld, und die Diagramme brauchen je Typ eine andere Kennzahl.
- **1RM nach Epley** (`weight * (1 + reps / 30)`), `epley()` in `core.js`. Eine Formel, in einer Zeile nachvollziehbar, bei den üblichen 3–12 Wdh genau genug. Die Zahl ist als Schätzung ausgewiesen, nicht als Messwert.
- **Standard-Theme dunkel.** Das Studio ist abends und die App wird aus der Hand gelesen.
- **`epley()` gibt bei einer Wiederholung das Gewicht selbst zurück**, statt die Formel anzuwenden. Epley gilt ab zwei Wiederholungen; bei einem Einersatz schriebe sie 3,3 % dazu, die nie gehoben wurden. Eine App, die nicht bewertet, darf keinen Bestwert erfinden.
- **`weekBuckets()` rechnet rückwärts in Kalendertagen (`setDate`), nicht in Millisekunden.** Bei der Umstellung auf Sommerzeit ist eine Woche nur 167 Stunden lang; feste 7 × 86 400 000 ms landen dann am Sonntag 23:00 und damit eine Woche zu weit zurück. Die Folge war, dass eine ganze Woche aus dem Diagramm fiel und ihre Trainings still nicht mitgezählt wurden — in Europe/Berlin die Woche vom 23.03.2026. `tests/core-test.js` prüft das um alle vier Umstellungen 2026 herum.
- **Die Testdaten sind gesät** (`tests/daten.js`, mulberry32): derselbe Aufruf gibt denselben Datensatz, sonst wäre ein roter Test nicht nachstellbar. Die Saat ist über `GYM_SEED=` vor `node tests/core-test.js` umstellbar, weil die Tests sonst unbemerkt an einer einzigen Zufallsfolge hängen — vier von zehn Saaten haben beim ersten Durchlauf einen Test aufgedeckt, der nur mit Saat 42 grün war.
- **In der laufenden Woche ohne Training zeichnet `bars()` keinen Balken**, markiert die Woche an der Beschriftung aber trotzdem. An einem Ruhetag ist also ein markierter, leerer Wochenplatz zu sehen — so gewollt, ein Balken der Höhe 0 wäre von einem sehr kleinen Balken nicht zu unterscheiden.
- **Bestwerte zeigen, nicht bewerten.** Die App zeigt Verlauf, Höchstwerte und unter jedem Diagramm einen Satz zur Einordnung; sie gibt keine Empfehlung und kein Urteil über ein Training ab.

## Abweichungen vom Skill
1. **Einstellungen als vierter Tab statt als Sheet.** Das Briefing nennt sie als eigene Ansicht, und Pausenzeit, Übungsverwaltung, Backup und Theme sind zusammen zu viel für ein Sheet. `--tabs` steht deshalb auf 4.
2. **Zahlenfelder sind `type="text"` mit `inputmode="decimal"`** statt `type="number"` mit `step="any"`. Android verwirft bei `type="number"` das deutsche Komma, der Wert kommt leer an. `num()` parst Komma und Punkt gleich, die Tastatur bleibt die Zifferntastatur.
3. **Unbenutzte Vorlage-Bausteine entfernt:** Hero, Metrik-Karte (`.grid2`, `.mcard`), `.meter` und `Charts.gauge()`. Der Gymtracker ist ein Logger ohne Kennzahlen-Dashboard; die Stücke wären toter Code in Dateien, die bei jeder Änderung mitgelesen werden. Welche Bausteine das genau waren, steht in `CLAUDE.md`.
4. **`tools/headless.js` zusätzlich in `tools/`.** Der Skill sieht die Prüf-Schnipsel zum Einfügen in die Browser-Konsole vor. Gebaut wurde der Gymtracker von Hintergrund-Sitzungen ohne Browser-Pane; `headless.js` lässt dieselben Prüfungen (Überlauf, Kontrast, Touch-Ziele, Löschwege, Installieren-Knopf, Zurück-Taste) in Chrome headless über alle Ansichten und Sheets laufen. `node tools/headless.js` und `node tools/headless.js --dialoge`, Voraussetzung ist `python3 -m http.server 8123` im Projektordner. Geht wie der ganze Ordner nicht mit hoch.
5. **Extras um Cardio und Dehnen ergänzt.** In den Notizen stand nur Sauna. Zwei weitere Markierungen kosten nichts und ersparen das Notizfeld für den häufigsten Fall.

Keine Abweichung, nur zur Klarstellung: `core.js` ist eine eigene Datei, weil die Rechenlogik 347 Zeilen hat und damit über der Schwelle von 300 liegt. Sie hat kein DOM, endet mit dem `module.exports`-Zweig und wird von `tests/` in Node geprüft.

## Offen
Nur am Handy prüfbar:
- [ ] Benachrichtigung „Pause vorbei" erscheint bei **gesperrtem** Handy (Berechtigung wird beim ersten Start des Timers erfragt)
- [ ] Weiterleitung dieser Benachrichtigung an die Garmin-Uhr — hängt an Android und der Garmin-App, von der PWA aus nicht garantiert
- [ ] Screen Wake Lock hält den Bildschirm während eines laufenden Trainings an (`navigator.wakeLock`, in manchen Browsern und bei Energiesparmodus nicht verfügbar)
- [ ] Vibration am Ende der Pause (`navigator.vibrate`, auf iOS nicht vorhanden)
- [ ] Installieren-Knopf erscheint, Chrome schickt das echte `beforeinstallprompt`
- [ ] Animationen laufen flüssig; mit „Bewegung reduzieren" bewegt sich nichts
- [ ] Weichzeichner der unteren Leiste beim Scrollen

Sonstiges: nichts offen. Geprüft und in Ordnung: Pausenleiste und untere Leiste sitzen
in 375 px exakt aneinander statt übereinander (Pausenleiste 576–636, Tableiste 636–700),
gemessen mit `node tools/headless.js`.
