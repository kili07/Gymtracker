# Gymtracker

Stack, harte Regeln, Bau-Reihenfolge und Upload stehen im Skill `web-app` und gelten vorrangig. Entscheidungen und offene Punkte stehen in `DECISIONS.md`. Diese Datei hält nur fest, was an **dieser** App anders oder eigen ist.

Kurzname `gym`: alle Speicher-Schlüssel (`gym.v1`, `gym.theme`, `gym.view`, `gym.reload`) und der Cache (`gym-v…`) tragen diesen Präfix.

## Richtung
Dunkler, ruhiger Trainingslogger fürs Handy, der im Studio mit einer Hand zu bedienen ist: große Flächen, wenig Text, die Zahl des Satzes im Mittelpunkt. Die App bewertet nicht, sie zeigt Verlauf und Bestwerte.

Akzent: Violett, `--accent` (`#A78BFA` dunkel, `#6D28D9` hell). Nur primäre Aktionen, aktiver Tab/Chip, Fortschritt der Pausenleiste und die Hauptlinie der Diagramme. Standard-Theme: dunkel.

## Abweichungen von der Vorlage in tokens.css
| Token | Wert dunkel / hell | Zweck |
|---|---|---|
| `--accent`, `--accent-soft`, `--accent-line` | `#A78BFA` / `#6D28D9` | eigener Akzent statt Mint der Vorlage |
| `--bar` | `#A78BFA` / `#6D28D9` | Balken (Volumen, Sätze je Woche) im Akzent |
| `--tabs` | 4 | Heute, Verlauf, Übungen, Einstellungen |
| `--rest-h` | 60px | Höhe der Pausenleiste über der unteren Leiste |

Zustandsfarben (`--st-low/mid/high`) und alle Flächen bleiben wie in der Vorlage.

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
| Bestwerte-Reihe | `.stats` der Vorlage, Inhalt aus `Core.bests()` |
| Suchfeld mit Lupe (Übungsliste, Übungswahl) | `.field-ic` in `style.css`; die Liste wird einzeln neu geschrieben, damit das Feld den Fokus behält |

## Rechenlogik
`core.js` enthält die Auswertung ohne DOM (Epley-1RM, Volumen, Serien je Übung, Bestwerte, Einordnung) und wird von `tests/core-test.js` in Node geprüft. Begründung in `DECISIONS.md`.
