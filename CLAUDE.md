# Gymtracker

Stack, harte Regeln, Bau-Reihenfolge und Upload stehen im Skill `web-app` und gelten vorrangig. Entscheidungen und offene Punkte stehen in `DECISIONS.md`. Diese Datei hält nur fest, was an **dieser** App anders oder eigen ist.

Kurzname `gym`: alle Speicher-Schlüssel (`gym.v1`, `gym.theme`, `gym.view`, `gym.reload`) und der Cache (`gym-v…`) tragen diesen Präfix.

## Richtung (ab 2.0.0: Scheiben)
Trainingslogger fürs Handy, im Studio mit einer Hand bedienbar: große Flächen, wenig Text, die Zahl des Satzes im Mittelpunkt. Warmes Anthrazit wie Gummiboden, Hantelscheiben-Gelb als einziger Akzent, schmale kräftige Display-Schrift für Zahlen und Überschriften, eckige Formen statt Pillen. Vorlage: Artboard „Gymtracker A: Scheiben" im Design-Artifact „PWA Startseiten" (09.11.2026). Die App bewertet nicht, sie zeigt Verlauf und Bestwerte. Standard-Theme: dunkel.

Schriften: Archivo (Text) und Big Shoulders Display (Zahlen, Überschriften), beide variabel, OFL, in `fonts/`.

Akzent: `--accent` für Text und Linien (`#E8B923` dunkel, `#7D5900` hell wegen Kontrast), `--accent-fill`/`--on-accent-fill` für Flächen mit Schrift (in beiden Themes Gelb mit dunkler Schrift). Nur primäre Aktionen, aktiver Tab/Chip, Pausenleiste, Hauptlinie und Balken der Diagramme, Bestwert-Marke.

## Eigene Tokens in tokens.css
| Token | Zweck |
|---|---|
| `--accent-fill`, `--on-accent-fill` | Gelbe Fläche mit dunkler Schrift (Start-Knopf, Primärknöpfe, Schalter, Bestwert) |
| `--font-display`, `--fs-display`, `--fs-title`, `--fs-set`, `--w-display` | Display-Schrift: Überschrift auf Heute (54 px), Titel der Ansichten, Satzzahl |
| `--r-tag` | 2 px für kleine Marken; alle Radien bewusst klein (4/6/12 px) |
| `--day-on`, `--day-off` | Wochenleiste auf Heute |
| `--bar-steel`, `--plate-25` bis `--plate-1` | Hantelstange und Scheiben (Farbcode olympischer Scheiben) |
| `--tabs` | 4: Heute, Verlauf, Übungen, Mehr (Einstellungen) |
| `--rest-h` | 64px, Pausenleiste über der unteren Leiste |

Labels (`.lbl`, `label`) und Abschnittsüberschriften (`.sec-h`) ohne Großbuchstaben und Sperrung. Der Tab Einstellungen heißt in der Leiste „Mehr".

## Abweichung in style.css
`.bar` und `.bar.cur` sind gegenüber der Vorlage vertauscht: fertige Wochen stehen im Akzent, die laufende blass. Die Vorlage färbt den laufenden Zeitraum als einzigen kräftig und widerspricht damit der Regel „Laufender Zeitraum blasser oder hohl, weil noch nicht fertig" (`referenz/diagramme.md`). Dieselbe Korrektur steht jetzt auch in der Vorlage des Skills.

Gelöscht, weil ohne Kennzahlen-Dashboard unbenutzt: Hero, Gauge, Metrik-Karte (`.grid2`, `.mcard`), `.meter` und `Charts.gauge()`.

## Eigene Bausteine
| Baustein | Wo |
|---|---|
| Pausenleiste (fest über der Tableiste, Restzeit, ±15 s, Überspringen) | `renderRest()` in `app.js`, `.restbar` in `style.css` |
| Übungsblock im laufenden Training mit Satzliste | `exBlock()` und `setText()` in `app.js`, `.exblock`/`.setlist`/`.setrow` in `style.css` |
| Stepper (Zahl mit −/+ und freiem Feld) | `stepper()` in `app.js`, `.step` in `style.css` |
| Übungszeile mit letztem Satz und Sparkline | `exRow()` in `app.js`, nutzt `.row` |
| Kopf auf Heute: Woche und Zahl der Trainings groß, Tagesleiste Mo bis So als Balken, Wochen am Stück | `weekCard()` in `app.js`, `.wk-hero`/`.weekstrip`/`.wd` in `style.css` |
| Letztes Training: je Übung bester Satz groß, rechts Hantel mit Scheiben oder Bestwert-/Änderungs-Pill | `lastCard()`, `setBig()`, `barbell()`, `topSet()`, `exCompare()` in `app.js`, `.lt-*`/`.barbell`/`.plate` in `style.css` |
| Scheiben je Seite (gierig 25/20/15/10/5/2,5/1,25 kg), Einstellung je Übung `plates` (`''`, `bar`, `load`) | `Core.platesFor()`, `Core.platesDefault()`, Segment in `newExercise()`/`editExercise()` |
| Verlauf nach Kalenderwochen (Diese Woche, Letzte Woche, KW n), je Training Muskelgruppen statt Übungsnamen | `sessionWeeks()`, `sessionGroups()`, `isoWeek()` in `app.js` |
| Übungsliste als eine Karte mit Gruppen-Zwischenzeilen | `exListHtml()` in `app.js`, `.row-h`/`.exlist` in `style.css` |
| Übungsseite: ein Diagramm mit Kennzahl-Umschalter, Ablesezeile zeigt zuerst den letzten Wert | `chartBlock()`, `METRICS` in `app.js` |
| Beenden-Sheet mit Zusammenfassung, Notiz und Extras | `endSession()`, `wireExtraChips()` in `app.js` |
| Einstellungen als gruppierte Zeilen, Umschalter in `.row-stack` | `renderEinst()` in `app.js`, `.row-stack` in `style.css` |
| Bestwerte-Reihe | `.stats` der Vorlage, Inhalt aus `Core.bests()` |
| Suchfeld mit Lupe (Übungsliste, Übungswahl) | `.field-ic` in `style.css`; die Liste wird einzeln neu geschrieben, damit das Feld den Fokus behält |

## Rechenlogik
`core.js` enthält die Auswertung ohne DOM (Epley-1RM, Volumen, Serien je Übung, Bestwerte, Einordnung) und wird von `tests/core-test.js` in Node geprüft. Begründung in `DECISIONS.md`.
