'use strict';
/* ═══════════════════════════════════════════════════════════════
   Gymtracker: Logik

   Gerechnet wird in core.js (ohne DOM, in Node getestet), gezeichnet
   hier. Aufbau:
   1. Konstanten, Helfer, Icons
   2. Daten: Laden, Speichern, Theme
   3. Navigation und Rendern
   4. Bewegung
   5. Ansicht Heute: Training loggen
   6. Pausentimer, Wake Lock, Benachrichtigung
   7. Satz-Sheet, Übungswahl, Notiz
   8. Ansicht Verlauf
   9. Ansicht Übungen und Übung (Diagramme)
   10. Ansicht Einstellungen, Backup
   11. Sheet und Dialoge
   12. Zurück-Taste
   13. Updates, Installieren
   14. Diagramme ablesen, Bausteine
   15. Verdrahten, Start
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. Konstanten, Helfer, Icons ───────────────────────────── */
const KEY = 'gym.v1';
/* Bei jeder Änderung hochzählen: wird in den Einstellungen angezeigt, damit
   sich auf dem Handy prüfen lässt, welche Fassung wirklich läuft. */
const APP_VERSION = '1.4.0';

const THEME_KEY = 'gym.theme';
const NOTIFY_KEY = 'gym.notify';      // Berechtigung schon einmal erfragt? Gerätesache, nicht im Backup
/* `bar` ist die Hintergrundfarbe des Themes und landet im
   <meta name="theme-color">, damit die Systemleiste des Handys mitzieht.
   Muss mit --bg in tokens.css übereinstimmen (einzige erlaubte feste Farbe). */
const THEMES = {
  dark:  { label: 'Dunkel', bar: '#0E1116' },
  light: { label: 'Hell',   bar: '#F4F6F8' },
};

const TYPE_LABEL = { weight: 'Gewicht', bodyweight: 'Körpergewicht', time: 'Zeit' };
/* Markierungen für eine Einheit. „Sauna" stand in den Notizen, Cardio und
   Dehnen sind dazugekommen, weil sie genauso nebenher laufen. */
const EXTRAS = [['sauna', 'Sauna'], ['cardio', 'Cardio'], ['stretch', 'Dehnen']];
const REST_STEP = 15;                 // ±15 s an der Pausenleiste

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fin = (v) => typeof v === 'number' && isFinite(v);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Formatierung immer über Intl, nie von Hand mit toFixed und Komma-Ersatz. */
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
/** Zahl mit passender Einzahl oder Mehrzahl: „1 Satz", „3 Sätze". */
const plural = (n, one, many) => `${nf0.format(n)} ${n === 1 ? one : many}`;
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfa = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const dfLong = new Intl.DateTimeFormat('de-DE',
  { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const dfDay = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const dfMed = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const dfAxis = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });
const dfShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
const dfClock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/* Eingaben können deutsches Komma enthalten, parseFloat allein verschluckt es. */
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const kg = (v) => nfa.format(v) + ' kg';
const kg0 = (v) => nf0.format(v) + ' kg';

/** Datum eines Eingabefelds (type="date") aus einer ISO-Zeit, lokal:
    toISOString() liefert UTC und verschiebt das Datum je nach Uhrzeit. */
function localDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* Icons: Lucide (ISC-Lizenz, licenses/lucide-ISC.txt), Pfade unverändert
   aus dem Paket lucide-static. Neue Symbole von dort holen, nie aus dem
   Gedächtnis schreiben. */
const lucide = (paths, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  check: lucide('<path d="M20 6 9 17l-5-5"/>'),
  chev:  lucide('<path d="m9 18 6-6-6-6"/>', 'chev'),
  plus:  lucide('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  minus: lucide('<path d="M5 12h14"/>'),
  x:     lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  play:  lucide('<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>'),
  stop:  lucide('<rect width="18" height="18" x="3" y="3" rx="2"/>'),
  timer: lucide('<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>'),
  trash: lucide('<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  pencil: lucide('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'),
  search: lucide('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
  archive: lucide('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
  restore: lucide('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/>'),
  note:  lucide('<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>'),
  info:  lucide('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
};
const BW_STEP = 0.1;                  // Körpergewicht: Plus/Minus in 100-g-Schritten

/* ── 2. Daten ───────────────────────────────────────────────── */
let db = Core.blank();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    db = Core.normalize(JSON.parse(raw), { uid, themes: Object.keys(THEMES) });
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Speichern fehlgeschlagen!'); console.error(e); }
}

/** Theme aufs Dokument legen. Der Spiegel in THEME_KEY ist das, was das
    Startskript in index.html liest; ohne ihn flackert der Start. */
function applyTheme(t) {
  if (!THEMES[t]) t = 'dark';
  db.settings.theme = t;
  document.documentElement.dataset.theme = t;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = THEMES[t].bar;
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* nicht schlimm */ }
}

/* Zugriffe, die überall gebraucht werden */
const exById = (id) => db.exercises.find((e) => e.id === id) || null;
const sessionById = (id) => db.sessions.find((s) => s.id === id) || null;
const activeSession = () => (db.active ? sessionById(db.active) : null);
const exName = (id) => { const e = exById(id); return e ? e.name : 'Gelöschte Übung'; };

/** Eintrag einer Übung in einer Einheit, auf Wunsch neu angelegt. */
function itemOf(se, exId, create) {
  let it = se.items.find((x) => x.exerciseId === exId);
  if (!it && create) { it = { exerciseId: exId, sets: [] }; se.items.push(it); }
  return it || null;
}

/* db.sessions bleibt absteigend sortiert: die Verlaufsliste und „letztes
   Training" lesen einfach von vorn. */
const sortSessions = () => db.sessions.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

/** Ein Satz als Text, je Übungstyp andere Felder. */
function setText(st, type) {
  if (type === 'time') return Core.clock(st.seconds);
  if (type === 'bodyweight') {
    return `${fin(st.reps) ? nf0.format(st.reps) : '–'} Wdh` + (fin(st.extra) && st.extra > 0 ? ` +${kg(st.extra)}` : '');
  }
  // Alte, importierte Sätze haben teils nur das Gewicht: dann „– × 80 kg" statt einer erfundenen 0
  return `${fin(st.reps) ? nf0.format(st.reps) : '–'} × ${fin(st.weight) ? kg(st.weight) : '–'}`;
}

/* ── 3. Navigation und Rendern ──────────────────────────────── */
const TITLES = { heute: 'Heute', verlauf: 'Verlauf', uebungen: 'Übungen', uebung: 'Übung', einst: 'Einstellungen' };
const TABS = ['heute', 'verlauf', 'uebungen', 'einst'];
let view = 'heute';

/* Zustand der Ansichten (Tab, Zeitraum, Auswahl) liegt nicht im Datensatz,
   sondern in sessionStorage: Lädt die App wegen eines Updates neu, landet
   man wieder dort, wo man war. Ein frischer Start beginnt bei Heute. */
const VIEW_KEY = 'gym.view';
let range = 90;              // Zeitraum der Übungsansicht in Tagen, 0 = alles
let curEx = null;            // Übung auf der Unterseite

function saveViewState() {
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ view, range, curEx })); }
  catch (e) { /* privater Modus o.ä.: dann eben wieder Heute */ }
}
function restoreViewState() {
  let s;
  try { s = JSON.parse(sessionStorage.getItem(VIEW_KEY) || 'null'); } catch (e) { s = null; }
  if (!s || !TITLES[s.view]) return 'heute';
  if (typeof s.range === 'number') range = s.range;
  if (s.curEx && exById(s.curEx)) curEx = s.curEx;
  if (s.view === 'uebung' && !curEx) return 'uebungen';
  return s.view;
}

function nav(v) {
  view = v;
  $$('.view').forEach((s) => s.classList.toggle('hidden', s.id !== 'view-' + v));
  $$('.tabbar button[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === v));
  // Die Unterseite hat keinen Tab: dann bleibt „Übungen" markiert
  if (v === 'uebung') $('.tabbar button[data-nav="uebungen"]').classList.add('on');
  $('#btnBack').classList.toggle('hidden', v !== 'uebung');
  $('#btnNew').classList.toggle('hidden', v !== 'uebungen');
  window.scrollTo(0, 0);
  armBack();                    // Zurück soll in der App bleiben, nicht aus ihr führen
  animNext = true;              // ein Wechsel durch den Benutzer darf animieren
  render();
}

/* Ablesefunktionen der Diagramme: Schlüssel mit 'v' gehören zur Ansicht
   (render() räumt sie ab), mit 's' zum Sheet. */
const readers = new Map();
let rid = 0;

/** Alles neu zeichnen. Bei den Datenmengen einer Handy-App ist gezieltes
    Aktualisieren unnötige Komplexität: einmal neu rendern ist schnell genug
    und kann nicht aus dem Tritt geraten. Ausnahmen mit Grund: die
    Pausenleiste (tickt jede halbe Sekunde) und die Suchliste (Feld
    behält Fokus). */
function render() {
  for (const k of readers.keys()) if (k[0] === 'v') readers.delete(k);
  $('#viewTitle').textContent = view === 'uebung' && curEx ? exName(curEx) : (TITLES[view] || '');
  if (view === 'heute') renderHeute();
  else if (view === 'verlauf') renderVerlauf();
  else if (view === 'uebungen') renderUebungen();
  else if (view === 'uebung') renderUebung();
  else if (view === 'einst') renderEinst();
  renderRest();
  if (animNext) { animNext = false; runAnims($('#view-' + view)); }
  saveViewState();
}

/* ── 4. Bewegung ────────────────────────────────────────────────
   Zahlen zählen hoch, Balken füllen sich, in 600 ms mit ease-out
   (dieselbe Kurve wie --ease-out in tokens.css). Nur nach einem Wechsel
   durch den Benutzer, nicht wenn die App zwischendurch neu zeichnet.
   Im HTML steht immer der Endwert: Läuft nichts (reduzierte Bewegung,
   Seite im Hintergrund), stimmt die Anzeige trotzdem. */
let animNext = true;
const ANIM_MS = 600;
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Zahl, die beim ersten Zeichnen hochzählt. Im HTML steht der fertige Text.
    Nur für ganze Zahlen oder eine Nachkommastelle (dec), nie für Uhrzeiten. */
function countNum(v, dec) {
  const to = dec ? Math.round(v * 10) / 10 : Math.round(v);
  return `<span data-count="${to}"${dec ? ' data-dec="1"' : ''}>${esc((dec ? nf1 : nf0).format(to))}</span>`;
}

function runAnims(root) {
  if (!root || reduceMotion() || document.hidden) return;
  root.classList.add('anim');
  // Wieder abnehmen: Neuzeichnen durch die App soll die Linien nicht erneut einblenden
  setTimeout(() => root.classList.remove('anim'), ANIM_MS + 100);
  const items = $$('[data-count]', root).map((e) => ({ e, end: e.textContent, to: +e.dataset.count, dec: !!e.dataset.dec }));
  if (!items.length) return;
  const show = (it, v) => { it.e.textContent = (it.dec ? nf1 : nf0).format(v); };
  let done = false;
  const finish = () => { if (!done) { done = true; items.forEach((it) => { it.e.textContent = it.end; }); } };
  const t0 = performance.now();
  const step = (now) => {
    if (done) return;
    const p = Math.min(1, (now - t0) / ANIM_MS);
    if (p >= 1) { finish(); return; }
    const k = 1 - Math.pow(1 - p, 3);            // ease-out, wie --ease-out
    items.forEach((it) => show(it, it.to * k));
    requestAnimationFrame(step);
  };
  items.forEach((it) => show(it, 0));
  requestAnimationFrame(step);
  // Falls requestAnimationFrame nicht kommt (Tab im Hintergrund): Endwerte trotzdem setzen
  setTimeout(finish, ANIM_MS + 250);
}

/* ── 5. Ansicht Heute: Training loggen ──────────────────────── */
function renderHeute() {
  const el = $('#view-heute');
  const se = activeSession();
  $('#topSub').textContent = se ? 'Training läuft' : '';
  el.innerHTML = se ? liveSession(se) : noSession();
}

/** Kein laufendes Training: Knopf zum Starten, darunter die Woche und das
    letzte Training als Anknüpfung. */
function noSession() {
  const types = Core.typeMap(db.exercises);
  if (!db.sessions.length) {
    return `<div class="empty">
      <h2>Noch kein Training</h2>
      <p>Starte ein Training und logge Satz für Satz. Gewicht und Wiederholungen stehen beim nächsten Mal schon da.</p>
      <button class="btn btn-primary" data-act="start">${ICON.play}Training starten</button>
    </div>`;
  }
  const week = Core.weekBuckets(db.sessions, 1, types)[0];
  const last = db.sessions[0];
  const st = Core.sessionStats(last, types);
  return `<button class="btn btn-primary btn-block btn-xl" data-act="start">${ICON.play}Training starten</button>
    <div class="sec-h">Diese Woche</div>
    <div class="card">
      <div class="stats stats-top">
        <div><span class="lbl">Trainings</span><span class="num">${countNum(week.sessions)}</span></div>
        <div><span class="lbl">Sätze</span><span class="num">${countNum(week.sets)}</span></div>
        <div><span class="lbl">Volumen</span><span class="num">${countNum(week.volume)}<small>kg</small></span></div>
      </div>
    </div>
    <div class="sec-h">Letztes Training</div>
    <button class="row card" data-act="session" data-id="${esc(last.id)}">
      <span class="grow"><span class="t">${esc(dfDay.format(new Date(last.date)))}</span>
      <span class="sub">${esc(sessionLine(st))}</span></span>${ICON.chev}
    </button>
    ${last.items.length ? `<div class="card"><div class="lbl">Übungen</div><p class="note">${esc(last.items.map((it) => exName(it.exerciseId)).join(', '))}</p></div>` : ''}`;
}

const sessionLine = (st) => `${plural(st.exercises, 'Übung', 'Übungen')} · ${plural(st.sets, 'Satz', 'Sätze')}`
  + (st.volume ? ` · ${kg0(st.volume)}` : '');

/** Laufendes Training: Kopf mit Kennwerten, je Übung ein Block, Notiz und
    Markierungen, Beenden. */
function liveSession(se) {
  const types = Core.typeMap(db.exercises);
  const st = Core.sessionStats(se, types);
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(se.date)) / 60000));
  const blocks = se.items.map((it) => exBlock(se, it)).join('');
  return `<div class="card live">
      <div class="live-top">
        <span class="grow"><span class="lbl">Seit ${esc(dfClock.format(new Date(se.date)))}</span>
        <span class="num live-dur">${countNum(mins)}<small>min</small></span></span>
        <button class="btn btn-sm" data-act="end">${ICON.stop}Beenden</button>
      </div>
      <div class="stats">
        <div><span class="lbl">Übungen</span><span class="num">${countNum(st.exercises)}</span></div>
        <div><span class="lbl">Sätze</span><span class="num">${countNum(st.sets)}</span></div>
        <div><span class="lbl">Volumen</span><span class="num">${countNum(st.volume)}<small>kg</small></span></div>
      </div>
    </div>
    ${blocks || `<div class="hint">${ICON.info}<span>Wähle die erste Übung. Die Werte vom letzten Mal stehen schon im Formular.</span></div>`}
    <button class="btn btn-block" data-act="addex">${ICON.plus}Übung hinzufügen</button>
    <div class="sec-h">Notiz und Extras</div>
    <button class="card row" data-act="note">
      <span class="grow"><span class="t">${se.note ? esc(se.note) : 'Notiz schreiben'}</span>
      <span class="sub">${se.note ? 'Antippen zum Ändern' : 'Wie lief es, was ist aufgefallen?'}</span></span>${ICON.note}
    </button>
    <div class="chips">${EXTRAS.map(([v, l]) =>
      `<button class="chip${se.extras.indexOf(v) >= 0 ? ' on' : ''}" data-act="extra" data-v="${esc(v)}" aria-pressed="${se.extras.indexOf(v) >= 0}">${esc(l)}</button>`).join('')}</div>`;
}

/** Ein Block je Übung im laufenden Training: Kopf, gelogte Sätze, Knopf. */
function exBlock(se, it) {
  const ex = exById(it.exerciseId);
  const type = ex ? ex.type : 'weight';
  const sets = it.sets.map((st, i) =>
    `<button class="setrow" data-act="editset" data-ex="${esc(it.exerciseId)}" data-i="${i}">
      <span class="setno">${i + 1}</span><span class="grow num">${esc(setText(st, type))}</span>${ICON.pencil}
    </button>`).join('');
  return `<div class="card exblock">
    <button class="ex-head" data-act="exsets" data-ex="${esc(it.exerciseId)}">
      <span class="grow"><span class="t">${esc(ex ? ex.name : 'Gelöschte Übung')}</span>
      <span class="sub">${esc(ex && ex.group ? ex.group : TYPE_LABEL[type])}</span></span>${ICON.chev}
    </button>
    ${sets ? `<div class="setlist">${sets}</div>` : ''}
    <button class="btn btn-primary btn-block" data-act="logset" data-ex="${esc(it.exerciseId)}">${ICON.plus}Satz loggen</button>
  </div>`;
}

function startSession() {
  const se = { id: uid(), date: new Date().toISOString(), end: null, note: '', extras: [], items: [] };
  db.sessions.unshift(se);
  db.active = se.id;
  save();
  wake(true);
  animNext = true;
  render();
  /* Erinnerung ans Körpergewicht: einmal je Tag, vor der ersten Übung.
     Speichern wie Überspringen führen weiter zur Übungswahl, damit die
     Frage das Training nie aufhält. */
  if (!Core.bodyWeightOn(db.bodyWeights, se.date)) {
    bodyWeightSheet({ remind: true, then: () => pickExercise(se.id) });
  } else {
    pickExercise(se.id);        // der erste Griff ist immer die Übungswahl
  }
}

function endSession() {
  const se = activeSession();
  if (!se) return;
  const st = Core.sessionStats(se, Core.typeMap(db.exercises));
  if (!st.sets) {
    askSheet('Training verwerfen?', 'Es ist kein Satz gespeichert. Das Training wird nicht in den Verlauf aufgenommen.',
      'Verwerfen', () => {
        db.sessions = db.sessions.filter((x) => x.id !== se.id);
        db.active = null; db.rest = null;
        save(); wake(false); closeSheet(); animNext = true; render(); toast('Verworfen');
      }, null, true);
    return;
  }
  askSheet('Training beenden?', `${sessionLine(st)} werden im Verlauf gespeichert.`, 'Beenden', () => {
    se.end = new Date().toISOString();
    db.active = null; db.rest = null;
    save(); wake(false); closeSheet(); animNext = true; render(); toast('Training gespeichert');
  });
}

function toggleExtra(sid, v) {
  const se = sessionById(sid);
  if (!se) return;
  const i = se.extras.indexOf(v);
  if (i >= 0) se.extras.splice(i, 1); else se.extras.push(v);
  save();
  render();
}

/* ── 6. Pausentimer, Wake Lock, Benachrichtigung ────────────────
   Gespeichert wird die Endzeit als Zeitstempel, nicht die Restzeit: nur so
   läuft die Pause nach Bildschirm aus oder App-Wechsel richtig weiter. Die
   Leiste tickt für sich und rührt render() nicht an, sonst verlöre ein
   offenes Eingabefeld jede halbe Sekunde den Inhalt. */
let restInt = null;

const restLeft = () => (db.rest ? Math.ceil((db.rest.endsAt - Date.now()) / 1000) : 0);
const restPct = () => {
  if (!db.rest || !db.rest.total) return 0;
  return Math.max(0, Math.min(100, (restLeft() / db.rest.total) * 100));
};

function startRest() {
  const s = db.settings.restSeconds;
  db.rest = { endsAt: Date.now() + s * 1000, total: s };
  save();
  askNotify();
  renderRest();
  startRestTick();
}

function addRest(sec) {
  if (!db.rest) return;
  db.rest.endsAt += sec * 1000;
  db.rest.total = Math.max(sec > 0 ? db.rest.total + sec : 1, restLeft());
  if (restLeft() <= 0) { restDone(false); return; }
  save();
  renderRest();
}

function skipRest() {
  db.rest = null;
  save();
  stopRestTick();
  renderRest();
}

function restDone(announce) {
  db.rest = null;
  save();
  stopRestTick();
  renderRest();
  if (announce === false) return;
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) { /* nicht überall erlaubt */ }
  notifyRest();
  toast('Pause vorbei');
}

function startRestTick() { if (!restInt) restInt = setInterval(restTick, 500); }
function stopRestTick() { if (restInt) { clearInterval(restInt); restInt = null; } }

/** Nur die Zahl und der Balken werden angefasst, nichts neu gezeichnet. */
function restTick() {
  if (!db.rest) { stopRestTick(); return; }
  if (restLeft() <= 0) { restDone(true); return; }
  const t = $('#restbar .rest-time');
  if (t) t.textContent = Core.clock(restLeft());
  const p = $('#restbar .rest-prog > i');
  if (p) p.style.width = restPct() + '%';
}

function renderRest() {
  const bar = $('#restbar');
  if (!db.rest) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    document.body.classList.remove('with-rest');
    return;
  }
  document.body.classList.add('with-rest');
  bar.classList.remove('hidden');
  bar.innerHTML = `<div class="rest-prog"><i style="width:${restPct()}%"></i></div>
    <div class="rest-in">
      <span class="rest-ic">${ICON.timer}</span>
      <span class="grow"><span class="lbl">Pause</span><span class="num rest-time">${esc(Core.clock(restLeft()))}</span></span>
      <button class="btn btn-sm" data-rest="-${REST_STEP}">−${REST_STEP}</button>
      <button class="btn btn-sm" data-rest="${REST_STEP}">+${REST_STEP}</button>
      <button class="icon-btn" data-rest="0" aria-label="Pause überspringen">${ICON.x}</button>
    </div>`;
  startRestTick();
}

/** Beim ersten Pausenstart nach der Erlaubnis fragen – danach nie wieder,
    auch wenn sie verweigert wurde. */
function askNotify() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try {
    if (localStorage.getItem(NOTIFY_KEY)) return;
    localStorage.setItem(NOTIFY_KEY, '1');
  } catch (e) { /* privater Modus: dann wird eben jedes Mal gefragt */ }
  try { Notification.requestPermission(); } catch (e) { /* älteres Chrome */ }
}

/** Hinweis am Ende der Pause. Über den Service Worker, weil eine
    Benachrichtigung aus der Seite heraus bei gesperrtem Bildschirm
    verworfen wird. */
async function notifyRest() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opt = { body: 'Nächster Satz.', tag: 'gym-rest', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) { reg.showNotification('Pause vorbei', opt); return; }
    new Notification('Pause vorbei', opt);
  } catch (e) { /* kein Service Worker, keine Benachrichtigung */ }
}

/* Bildschirm während eines Trainings wach halten. Der Browser nimmt die
   Sperre beim Wegschalten von selbst zurück, deshalb wird sie beim
   Zurückkommen neu angefragt. */
let wakeLock = null;
async function wake(on) {
  try {
    if (on) {
      if (wakeLock || !navigator.wakeLock || document.hidden) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (wakeLock) {
      const w = wakeLock;
      wakeLock = null;
      await w.release();
    }
  } catch (e) { /* nicht unterstützt oder nicht erlaubt: dann ohne */ }
}

/* ── 7. Satz-Sheet, Übungswahl, Notiz ───────────────────────── */
/** Satz anlegen oder ändern. `idx` null = neuer Satz. Beim neuen Satz
    stehen die Werte des letzten Satzes schon im Formular: erst der letzte
    von heute, sonst der aus dem jüngsten Training mit dieser Übung. */
function openSetSheet(sid, exId, idx, back) {
  const se = sessionById(sid);
  const ex = exById(exId);
  if (!se || !ex) return;
  const it = itemOf(se, exId, true);
  const isNew = idx == null;
  let base = isNew ? null : it.sets[idx];
  if (!base) {
    const prev = it.sets.length ? { set: it.sets[it.sets.length - 1] } : Core.lastSet(db.sessions, exId, se.id);
    base = prev ? prev.set : {};
  }
  const step = db.settings.weightStep;
  const done = it.sets.map((st, i) => `<span class="setpill${!isNew && i === idx ? ' on' : ''}">${esc(setText(st, ex.type))}</span>`).join('');
  let form = '';
  if (ex.type === 'time') {
    form = stepper('f_secs', 'Dauer', base.seconds, 5, 's', 0);
  } else if (ex.type === 'bodyweight') {
    form = stepper('f_reps', 'Wiederholungen', base.reps, 1, 'Wdh', 1)
      + repChips(repSuggest(se, it, exId, base.reps), base.reps)
      + stepper('f_extra', 'Zusatzgewicht', base.extra || 0, step, 'kg', 0);
  } else {
    form = stepper('f_reps', 'Wiederholungen', base.reps, 1, 'Wdh', 1)
      + repChips(repSuggest(se, it, exId, base.reps), base.reps)
      + stepper('f_weight', 'Gewicht', base.weight, step, 'kg', 0);
  }
  openSheet(isNew ? 'Satz loggen' : `Satz ${idx + 1} ändern`, `
    <div class="lbl">${esc(ex.name)}${ex.group ? ' · ' + esc(ex.group) : ''}</div>
    ${done ? `<div class="setpills">${done}</div>` : ''}
    ${form}
    ${isNew ? `<p class="note">Nach dem Speichern läuft die Pause von ${esc(Core.clock(db.settings.restSeconds))}.</p>` : ''}
    ${isNew ? '' : '<button class="btn btn-danger btn-block" id="f_del">Satz löschen</button>'}
  `, () => {
    const st = Core.cleanSet(ex.type === 'time'
      ? { seconds: num($('#f_secs').value) }
      : {
        reps: num($('#f_reps').value),
        weight: ex.type === 'weight' ? num($('#f_weight').value) : null,
        extra: ex.type === 'bodyweight' ? num($('#f_extra').value) : null,
      });
    if (!st) { toast(ex.type === 'time' ? 'Dauer fehlt' : 'Wiederholungen fehlen'); return; }
    if (isNew) it.sets.push(st); else it.sets[idx] = st;
    save();
    closeSheet();
    // Die Pause gehört zum laufenden Training, nicht zum Nachtragen im Verlauf
    if (isNew && se.id === db.active) startRest();
    render();
  }, 'Speichern');
  if (back) $('#sheetCancel').onclick = back;
  if (ex.type !== 'time') {
    const repsIn = $('#f_reps');
    $('#sheetBody').onclick = (e) => {
      const c = e.target.closest('[data-rep]');
      if (c) repsIn.value = nf0.format(+c.dataset.rep);
      // Nach −/+ am Stepper: der zählt erst im Handler am #sheet hoch, also danach angleichen
      setTimeout(syncRepChips, 0);
    };
    repsIn.addEventListener('input', syncRepChips);
  }
  if (!isNew) {
    $('#f_del').onclick = () => askSheet('Satz löschen?', 'Der Satz wird aus dem Training entfernt.', 'Löschen', () => {
      it.sets.splice(idx, 1);
      if (!it.sets.length) se.items = se.items.filter((x) => x !== it);
      save(); closeSheet(); render(); toast('Gelöscht');
    }, () => openSetSheet(sid, exId, idx, back), true);
  }
}

/** Vorschläge für die Wiederholungen: der vorausgefüllte Wert mit zwei
    darunter und darüber, dazu die Wdh von heute und vom letzten Training
    dieser Übung. Ohne jeden Wert die üblichen Zahlen. Höchstens acht,
    aufsteigend, damit die Reihe in eine Zeile am Handy passt. */
function repSuggest(se, it, exId, reps) {
  const set = new Set();
  if (fin(reps) && reps > 0) for (let d = -2; d <= 2; d++) if (reps + d >= 1) set.add(reps + d);
  const prev = db.sessions.find((x) => x.id !== se.id && x.items.some((y) => y.exerciseId === exId && y.sets.length));
  const add = (sets) => sets.forEach((st) => { if (fin(st.reps) && st.reps > 0) set.add(Math.round(st.reps)); });
  add(it.sets);
  if (prev) add(prev.items.find((y) => y.exerciseId === exId).sets);
  if (!set.size) [5, 6, 8, 10, 12, 15].forEach((v) => set.add(v));
  let list = Array.from(set).sort((a, b) => a - b);
  // Zu viele: die nächsten am vorausgefüllten Wert behalten
  if (list.length > 8 && fin(reps)) list = list.sort((a, b) => Math.abs(a - reps) - Math.abs(b - reps)).slice(0, 8).sort((a, b) => a - b);
  return list.slice(0, 8);
}

function repChips(list, cur) {
  return `<div class="chips chips-sheet chips-reps" role="group" aria-label="Wiederholungen wählen">${list.map((v) =>
    `<button class="chip num${v === cur ? ' on' : ''}" data-rep="${v}" aria-pressed="${v === cur}">${nf0.format(v)}</button>`).join('')}</div>`;
}

/** Markierung der Vorschläge an den Wert im Feld angleichen. */
function syncRepChips() {
  const el = $('#f_reps');
  if (!el) return;
  const v = num(el.value);
  $$('[data-rep]', $('#sheetBody')).forEach((c) => {
    const on = +c.dataset.rep === v;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

/** Sätze einer Übung in einer Einheit: ändern, nachtragen, Übung entfernen. */
function setsSheet(sid, exId, back) {
  const se = sessionById(sid);
  const ex = exById(exId);
  if (!se || !ex) return;
  const it = itemOf(se, exId, true);
  const rows = it.sets.map((st, i) =>
    `<button class="row" data-ss="${i}"><span class="setno">${i + 1}</span>
      <span class="grow num">${esc(setText(st, ex.type))}</span>${ICON.pencil}</button>`).join('');
  const reopen = () => setsSheet(sid, exId, back);
  openSheet(ex.name, `
    <div class="lbl">${esc(dfDay.format(new Date(se.date)))}${ex.group ? ' · ' + esc(ex.group) : ''}</div>
    ${rows ? `<div class="rows">${rows}</div>` : '<p class="dlg-t">Noch kein Satz.</p>'}
    <button class="btn btn-primary btn-block" id="ss_add">${ICON.plus}Satz nachtragen</button>
    <button class="btn btn-block" id="ss_open">Verlauf der Übung</button>
    <button class="btn btn-danger btn-block" id="ss_del">Übung aus Training entfernen</button>
  `, null);
  if (back) $('#sheetCancel').onclick = back;
  $('#sheetBody').onclick = (e) => {
    const r = e.target.closest('[data-ss]');
    if (r) openSetSheet(sid, exId, +r.dataset.ss, reopen);
  };
  $('#ss_add').onclick = () => openSetSheet(sid, exId, null, reopen);
  $('#ss_open').onclick = () => { closeSheet(); openEx(exId); };
  $('#ss_del').onclick = () => askSheet('Übung entfernen?',
    `${plural(it.sets.length, 'Satz wird', 'Sätze werden')} aus diesem Training gelöscht.`, 'Entfernen', () => {
      se.items = se.items.filter((x) => x !== it);
      save(); closeSheet(); render(); toast('Entfernt');
    }, reopen, true);
}

/** Übung für eine Einheit wählen: Suche, zuletzt genutzte oben, neue Übung
    direkt anlegen. Nach der Wahl geht es ohne Umweg ins Satz-Formular. */
function pickExercise(sid, back) {
  const se = sessionById(sid);
  if (!se) return;
  openSheet('Übung wählen', `
    <div class="field-ic">${ICON.search}<input id="f_q" autocomplete="off" placeholder="Übung suchen" aria-label="Übung suchen"></div>
    <button class="btn btn-block" id="f_newex">${ICON.plus}Neue Übung anlegen</button>
    <div id="pickList"></div>
  `, null);
  $('#sheet').classList.add('sheet-tall');   // feste Höhe: die Liste springt beim Tippen nicht
  if (back) $('#sheetCancel').onclick = back;
  const list = $('#pickList');
  /* Nur die Liste neu schreiben, nicht das Sheet: ein Neuaufbau nähme dem
     Suchfeld bei jedem Buchstaben den Fokus. */
  const draw = (q) => { list.innerHTML = pickRows(se, q); };
  draw('');
  $('#f_q').oninput = (e) => { draw(e.target.value); $('#sheetBody').scrollTop = 0; };
  $('#f_newex').onclick = () => newExercise((id) => {
    itemOf(se, id, true); save();
    openSetSheet(sid, id, null, () => pickExercise(sid, back));
  }, () => pickExercise(sid, back));
  $('#sheetBody').onclick = (e) => {
    const r = e.target.closest('[data-pick]');
    if (!r) return;
    const id = r.dataset.pick;
    itemOf(se, id, true);
    save();
    openSetSheet(sid, id, null, () => pickExercise(sid, back));
  };
}

/** Übungen nach Muskelgruppe, Gruppen und Namen alphabetisch, ohne Gruppe
    am Ende. Für Übungswahl und Übungsliste. */
const collator = new Intl.Collator('de-DE', { sensitivity: 'base' });
function byGroup(list) {
  const groups = new Map();
  list.forEach((e) => {
    const g = e.group || 'Ohne Gruppe';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  });
  return Array.from(groups, ([g, l]) => ({ g, list: l.sort((a, b) => collator.compare(a.name, b.name)) }))
    .sort((a, b) => (a.g === 'Ohne Gruppe') - (b.g === 'Ohne Gruppe') || collator.compare(a.g, b.g));
}

function pickRows(se, q) {
  const needle = String(q || '').trim().toLowerCase();
  const hit = (e) => !needle || (e.name + ' ' + e.group).toLowerCase().indexOf(needle) >= 0;
  const open = db.exercises.filter((e) => !e.archived && hit(e));
  if (!open.length) return '<p class="dlg-t">Keine Übung gefunden. Lege sie oben neu an.</p>';
  const row = (e) => {
    const inSession = se.items.some((x) => x.exerciseId === e.id);
    const last = Core.lastSet(db.sessions, e.id, se.id);
    return `<button class="row" data-pick="${esc(e.id)}">
      <span class="grow"><span class="t">${esc(e.name)}${inSession ? ' ' + ICON.check : ''}</span>
      <span class="sub">${esc(e.group || TYPE_LABEL[e.type])}${last ? ' · zuletzt ' + esc(setText(last.set, e.type)) : ''}</span></span>${ICON.chev}
    </button>`;
  };
  /* Wird gesucht, steht jeder Treffer in einer Liste: die Aufteilung in
     „zuletzt genutzt" und „alle" würde sonst genau die gesuchte Übung
     verschlucken, wenn sie in beiden Gruppen landet. */
  if (needle) return `<div class="lbl">Treffer</div><div class="rows">${byGroup(open).map((b) => b.list).flat().map(row).join('')}</div>`;
  // Zuletzt genutzte zuerst: im Studio greift man meist wieder zum Gleichen
  const recent = [];
  db.sessions.forEach((s) => s.items.forEach((it) => {
    if (recent.indexOf(it.exerciseId) < 0) recent.push(it.exerciseId);
  }));
  const top = recent.map((id) => open.find((e) => e.id === id)).filter(Boolean).slice(0, 5);
  let out = '';
  if (top.length) out += `<div class="lbl">Zuletzt genutzt</div><div class="rows">${top.map(row).join('')}</div>`;
  /* Darunter alle nach Muskelgruppe. Die zuletzt genutzten stehen dort noch
     einmal: sonst fehlte einer Gruppe genau die Übung, die man sucht. */
  out += byGroup(open).map((b) => `<div class="lbl">${esc(b.g)}</div><div class="rows">${b.list.map(row).join('')}</div>`).join('');
  return out;
}

function noteSheet(sid, back) {
  const se = sessionById(sid);
  if (!se) return;
  openSheet('Notiz', `
    <label>Notiz<textarea id="f_note" rows="4" placeholder="Wie lief es?">${esc(se.note)}</textarea></label>
    <div class="lbl">Extras</div>
    <div class="chips chips-sheet">${EXTRAS.map(([v, l]) =>
      `<button class="chip${se.extras.indexOf(v) >= 0 ? ' on' : ''}" data-chip="${esc(v)}" aria-pressed="${se.extras.indexOf(v) >= 0}">${esc(l)}</button>`).join('')}</div>
  `, () => {
    se.note = $('#f_note').value.trim();
    save(); closeSheet(); render(); toast('Gespeichert');
  });
  if (back) $('#sheetCancel').onclick = back;
  $('#sheetBody').onclick = (e) => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    const v = c.dataset.chip;
    const i = se.extras.indexOf(v);
    if (i >= 0) se.extras.splice(i, 1); else se.extras.push(v);
    const on = se.extras.indexOf(v) >= 0;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
    save();
  };
}

/* ── 8. Ansicht Verlauf ─────────────────────────────────────── */
function renderVerlauf() {
  const el = $('#view-verlauf');
  $('#topSub').textContent = db.sessions.length ? plural(db.sessions.length, 'Training', 'Trainings') : '';
  if (!db.sessions.length) {
    el.innerHTML = `${bodyWeightCard()}<div class="empty"><h2>Noch kein Training im Verlauf</h2>
      <p>Sobald Du ein Training beendet hast, steht es hier mit allen Sätzen.</p>
      <button class="btn btn-primary" data-nav="heute">Zu Heute</button></div>`;
    return;
  }
  const types = Core.typeMap(db.exercises);
  const weeks = Core.weekBuckets(db.sessions, 12, types);
  const bars = Charts.bars(weeks.map((w) => ({ label: dfAxis.format(new Date(w.start)), v: w.sets, cur: w.cur })),
    { fmtY: (v) => nf0.format(v) });
  const since = Date.now() - 30 * 86400000;
  const last30 = db.sessions.filter((s) => Date.parse(s.date) >= since);
  let sets30 = 0, vol30 = 0;
  last30.forEach((s) => { const st = Core.sessionStats(s, types); sets30 += st.sets; vol30 += st.volume; });

  const rows = db.sessions.map((se) => {
    const st = Core.sessionStats(se, types);
    const ex = se.items.map((it) => exName(it.exerciseId)).join(', ');
    return `<button class="row row-wrap" data-act="session" data-id="${esc(se.id)}">
      <span class="grow"><span class="t">${esc(dfDay.format(new Date(se.date)))}${se.id === db.active ? ' <span class="tag">läuft</span>' : ''}</span>
      <span class="sub">${esc(sessionLine(st))}</span>
      <span class="sub">${esc(ex || 'ohne Übung')}</span></span>
      <span class="end">${se.extras.length ? `<span class="tag">${esc(se.extras.map(extraLabel).join(' · '))}</span>` : ''}${ICON.chev}</span>
    </button>`;
  }).join('');

  el.innerHTML = `${bodyWeightCard()}<div class="sec-h">Sätze je Woche</div>
    <div class="card">${chartBox(bars, (i) => weeks[i]
      ? `<b>${nf0.format(weeks[i].sets)}</b> ${weeks[i].sets === 1 ? 'Satz' : 'Sätze'} · ${plural(weeks[i].sessions, 'Training', 'Trainings')} · Woche ab ${esc(dfMed.format(new Date(weeks[i].start)))}`
      : null, '<span>Antippen zum Ablesen</span>')}
      <div class="stats">
        <div><span class="lbl">Trainings</span><span class="num">${countNum(last30.length)}</span></div>
        <div><span class="lbl">Sätze</span><span class="num">${countNum(sets30)}</span></div>
        <div><span class="lbl">Volumen</span><span class="num">${countNum(vol30)}<small>kg</small></span></div>
      </div>
      <p class="note">Kennwerte der letzten 30 Tage.</p>
    </div>
    <div class="sec-h">Alle Trainings</div>
    <div class="rows">${rows}</div>`;
}

/** Karte Körpergewicht oben im Verlauf: aktueller Wert, Änderung in 30
    Tagen, Verlauf der letzten Einträge. Zeigt, bewertet nicht. */
function bodyWeightCard() {
  const list = db.bodyWeights;
  const head = '<div class="sec-h">Körpergewicht</div>';
  if (!list.length) {
    return `${head}<div class="card">
      <p class="note">Noch kein Eintrag. Beim Start eines Trainings fragt die App einmal am Tag danach.</p>
      <button class="btn btn-block" data-act="bwadd">${ICON.plus}Gewicht eintragen</button></div>`;
  }
  const cur = list[0];
  // Vergleich mit dem jüngsten Eintrag, der mindestens 30 Tage älter ist
  const ref = list.find((b) => Date.parse(cur.date) - Date.parse(b.date) >= 30 * 86400000) || null;
  const diff = ref ? Math.round((cur.kg - ref.kg) * 10) / 10 : null;
  const pts = list.slice(0, 30).reverse();           // höchstens 30 Einträge, alt nach neu
  const fmt = (v) => nfa.format(v);
  let chart = '';
  if (pts.length >= 2) {
    const svg = Charts.line({ vals: pts.map((b) => b.kg), labels: pts.map((b) => dfAxis.format(new Date(b.date))), fmtY: fmt });
    chart = chartBox(svg, (i) => (pts[i]
      ? `<b>${esc(fmt(pts[i].kg))}</b> kg <span>${esc(dfMed.format(new Date(pts[i].date)))}</span>` : null),
    '<span>Antippen zum Ablesen</span>');
  }
  const sign = diff == null ? '' : (diff > 0 ? '+' : (diff < 0 ? '−' : '±'));
  return `${head}<div class="card">
    ${chart}
    <div class="stats${chart ? '' : ' stats-top'}">
      <div><span class="lbl">Aktuell</span><span class="num">${countNum(cur.kg, true)}<small>kg</small></span></div>
      <div><span class="lbl">30 Tage</span><span class="num">${diff == null ? '–' : esc(sign + nf1.format(Math.abs(diff)))}${diff == null ? '' : '<small>kg</small>'}</span></div>
      <div><span class="lbl">Einträge</span><span class="num">${countNum(list.length)}</span></div>
    </div>
    <p class="note">Zuletzt am ${esc(dfMed.format(new Date(cur.date)))}${ref ? `, verglichen mit ${esc(dfMed.format(new Date(ref.date)))}` : ''}.</p>
    <div class="btn-row">
      <button class="btn" data-act="bwadd">${ICON.plus}Eintragen</button>
      <button class="btn" data-act="bwlist">Alle Einträge</button>
    </div></div>`;
}

/** Körpergewicht eintragen oder ändern.
    opts.remind: Erinnerung beim Trainingsstart (heute, mit Überspringen).
    opts.date:   ISO eines vorhandenen Eintrags zum Ändern (mit Löschen).
    opts.then:   läuft nach Speichern, Überspringen und Abbrechen.
    opts.back:   Rückweg zum vorherigen Sheet. */
function bodyWeightSheet(opts) {
  opts = opts || {};
  const editing = opts.date ? Core.bodyWeightOn(db.bodyWeights, opts.date) : null;
  const today = new Date().toISOString();
  const preset = editing || Core.bodyWeightOn(db.bodyWeights, today) || db.bodyWeights[0] || null;
  const last = db.bodyWeights[0];
  const after = () => { if (opts.then) opts.then(); else closeSheet(); };
  const reopen = () => bodyWeightSheet(opts);
  openSheet(opts.remind ? 'Körpergewicht heute?' : (editing ? 'Eintrag ändern' : 'Körpergewicht'), `
    ${opts.remind ? '' : `<label>Tag<input id="f_bwdate" type="date" max="${esc(localDate(today))}" value="${esc(localDate(editing ? editing.date : today))}"></label>`}
    ${stepper('f_bw', 'Körpergewicht', preset ? preset.kg : null, BW_STEP, 'kg', 0)}
    ${last && !editing ? `<p class="note">Zuletzt ${esc(kg(last.kg))} am ${esc(dfMed.format(new Date(last.date)))}.</p>` : ''}
    ${opts.remind ? '<button class="btn btn-block" id="f_bwskip">Überspringen</button>' : ''}
    ${editing ? `<button class="btn btn-danger btn-block" id="f_bwdel">${ICON.trash}Eintrag löschen</button>` : ''}
  `, () => {
    const v = num($('#f_bw').value);
    if (v < 20 || v > 400) { toast('Gewicht zwischen 20 und 400 kg eintragen'); return; }
    let iso = today;
    const dv = $('#f_bwdate') && $('#f_bwdate').value;
    if (dv) {
      // Mittag des gewählten Tages: keine Zeitzone schiebt ihn auf den Vortag
      const d = new Date(dv + 'T12:00:00');
      if (localDate(d.toISOString()) !== localDate(today)) iso = d.toISOString();
    }
    // Beim Ändern auf einen anderen Tag den alten Eintrag nicht stehen lassen
    if (editing && Core.dayKey(editing.date) !== Core.dayKey(iso)) {
      db.bodyWeights = db.bodyWeights.filter((b) => b !== editing);
    }
    db.bodyWeights = Core.setBodyWeight(db.bodyWeights, iso, v);
    save(); render(); toast(`Körpergewicht: ${kg(Math.round(v * 10) / 10)}`);
    after();
  }, 'Speichern');
  $('#sheetCancel').onclick = opts.back || after;
  if (opts.remind) $('#f_bwskip').onclick = after;
  if (editing) {
    $('#f_bwdel').onclick = () => askSheet('Eintrag löschen?',
      `${kg(editing.kg)} vom ${dfMed.format(new Date(editing.date))} wird gelöscht.`, 'Löschen', () => {
        db.bodyWeights = db.bodyWeights.filter((b) => b !== editing);
        save(); render(); toast('Gelöscht');
        if (opts.back) opts.back(); else closeSheet();
      }, reopen, true);
  }
}

/** Alle Einträge, neueste zuerst; antippen zum Ändern oder Löschen. */
function bodyWeightList() {
  const reopen = () => bodyWeightList();
  const rows = db.bodyWeights.map((b, i) => {
    const prev = db.bodyWeights[i + 1];
    const d = prev ? Math.round((b.kg - prev.kg) * 10) / 10 : null;
    const dTxt = d == null || d === 0 ? '' : ` · ${d > 0 ? '+' : '−'}${nf1.format(Math.abs(d))} kg`;
    return `<button class="row" data-bw="${esc(b.date)}">
      <span class="grow"><span class="t num">${esc(kg(b.kg))}</span>
      <span class="sub">${esc(dfLong.format(new Date(b.date)))}${esc(dTxt)}</span></span>${ICON.pencil}
    </button>`;
  }).join('');
  openSheet('Körpergewicht', `
    <button class="btn btn-primary btn-block" id="bw_add">${ICON.plus}Eintrag nachtragen</button>
    ${rows ? `<div class="rows">${rows}</div>` : '<p class="dlg-t">Noch kein Eintrag.</p>'}
  `, null);
  $('#bw_add').onclick = () => bodyWeightSheet({ back: reopen, then: reopen });
  $('#sheetBody').onclick = (e) => {
    const r = e.target.closest('[data-bw]');
    if (r) bodyWeightSheet({ date: r.dataset.bw, back: reopen, then: reopen });
  };
}

const extraLabel = (v) => { const e = EXTRAS.find((x) => x[0] === v); return e ? e[1] : v; };

/** Eine Einheit ansehen: Kennwerte, Sätze je Übung, bearbeiten, löschen. */
function openSessionSheet(id, back) {
  const se = sessionById(id);
  if (!se) return;
  const types = Core.typeMap(db.exercises);
  const st = Core.sessionStats(se, types);
  const reopen = () => openSessionSheet(id, back);
  const blocks = se.items.map((it) => {
    const ex = exById(it.exerciseId);
    const type = ex ? ex.type : 'weight';
    return `<button class="row row-wrap" data-sx="${esc(it.exerciseId)}">
      <span class="grow"><span class="t">${esc(ex ? ex.name : 'Gelöschte Übung')}</span>
      <span class="sub">${esc(it.sets.map((s) => setText(s, type)).join('  ·  ')) || 'kein Satz'}</span></span>${ICON.pencil}
    </button>`;
  }).join('');
  openSheet(dfLong.format(new Date(se.date)), `
    <div class="stats stats-top">
      <div><span class="lbl">Sätze</span><span class="num">${nf0.format(st.sets)}</span></div>
      <div><span class="lbl">Volumen</span><span class="num">${nf0.format(st.volume)}<small>kg</small></span></div>
      <div><span class="lbl">Dauer</span><span class="num">${st.dur ? nf0.format(Math.round(st.dur / 60)) + '<small>min</small>' : '–'}</span></div>
    </div>
    ${se.extras.length ? `<div class="chips chips-sheet">${se.extras.map((v) => `<span class="chip on">${esc(extraLabel(v))}</span>`).join('')}</div>` : ''}
    ${se.note ? `<p class="dlg-t">${esc(se.note)}</p>` : ''}
    <div class="lbl">Übungen</div>
    ${blocks ? `<div class="rows">${blocks}</div>` : '<p class="dlg-t">Keine Übung erfasst.</p>'}
    <button class="btn btn-block" id="se_add">${ICON.plus}Übung nachtragen</button>
    <button class="btn btn-block" id="se_note">${ICON.note}Notiz und Extras</button>
    <button class="btn btn-block" id="se_date">Datum ändern</button>
    <button class="btn btn-danger btn-block" id="se_del">${ICON.trash}Training löschen</button>
  `, null);
  if (back) $('#sheetCancel').onclick = back;
  $('#sheetBody').onclick = (e) => {
    const r = e.target.closest('[data-sx]');
    if (r) setsSheet(id, r.dataset.sx, reopen);
  };
  $('#se_add').onclick = () => pickExercise(id, reopen);
  $('#se_note').onclick = () => noteSheet(id, reopen);
  $('#se_date').onclick = () => dateSheet(id, reopen);
  $('#se_del').onclick = () => askSheet('Training löschen?',
    `${sessionLine(st)} werden gelöscht. Das lässt sich nicht rückgängig machen.`, 'Löschen', () => {
      db.sessions = db.sessions.filter((x) => x.id !== id);
      if (db.active === id) { db.active = null; db.rest = null; wake(false); }
      save(); closeSheet(); render(); toast('Gelöscht');
    }, reopen, true);
}

function dateSheet(id, back) {
  const se = sessionById(id);
  if (!se) return;
  openSheet('Datum', `<label>Tag des Trainings<input id="f_date" type="date" value="${esc(localDate(se.date))}"></label>`,
    () => {
      const v = $('#f_date').value;
      if (v) {
        // Uhrzeit beibehalten: sie steht im Verlauf und in der Dauer
        const old = new Date(se.date);
        const d = new Date(v + 'T00:00:00');
        d.setHours(old.getHours(), old.getMinutes(), 0, 0);
        const shift = d.getTime() - old.getTime();
        se.date = d.toISOString();
        if (se.end) se.end = new Date(Date.parse(se.end) + shift).toISOString();
        sortSessions();
      }
      save(); closeSheet(); render(); toast('Gespeichert');
    });
  if (back) $('#sheetCancel').onclick = back;
}

/* ── 9. Ansicht Übungen und Übung ───────────────────────────── */
let exQuery = '';

function renderUebungen() {
  const el = $('#view-uebungen');
  const open = db.exercises.filter((e) => !e.archived);
  $('#topSub').textContent = plural(open.length, 'Übung', 'Übungen');
  el.innerHTML = `<div class="field-ic">${ICON.search}<input id="exQ" autocomplete="off" placeholder="Übung suchen" aria-label="Übung suchen" value="${esc(exQuery)}"></div>
    <div id="exList">${exListHtml()}</div>`;
  /* Nur die Liste neu schreiben: render() würde das Suchfeld ersetzen und
     ihm bei jedem Buchstaben den Fokus nehmen. */
  $('#exQ').oninput = (e) => { exQuery = e.target.value; $('#exList').innerHTML = exListHtml(); };
}

function exListHtml() {
  const needle = exQuery.trim().toLowerCase();
  const hit = (e) => !needle || (e.name + ' ' + e.group).toLowerCase().indexOf(needle) >= 0;
  const open = db.exercises.filter((e) => !e.archived && hit(e));
  const arch = db.exercises.filter((e) => e.archived && hit(e));
  if (!open.length && !arch.length) {
    return `<div class="empty"><h2>Keine Übung gefunden</h2>
      <p>${needle ? 'Andere Schreibweise versuchen – oder die Übung neu anlegen.' : 'Lege Deine erste Übung an.'}</p>
      <button class="btn btn-primary" data-act="newex">${ICON.plus}Neue Übung</button></div>`;
  }
  let out = byGroup(open).map((b) => `<div class="sec-h">${esc(b.g)}</div><div class="rows">${b.list.map(exRow).join('')}</div>`).join('');
  if (arch.length) out += `<div class="sec-h">Archiviert</div><div class="rows">${arch.map(exRow).join('')}</div>`;
  return out;
}

/** Zeile der Übungsliste: Name, Gruppe, letzter Wert und eine Sparkline der
    letzten acht Trainings. */
function exRow(e) {
  const pts = Core.exercisePoints(db.sessions, e.id, e.type);
  const key = e.type === 'weight' ? 'top' : (e.type === 'time' ? 'secs' : 'reps');
  const vals = pts.slice(-8).map((p) => p[key]);
  const last = pts.length ? pts[pts.length - 1] : null;
  const lastSet = Core.lastSet(db.sessions, e.id);
  return `<button class="row" data-act="ex" data-id="${esc(e.id)}">
    <span class="grow"><span class="t">${esc(e.name)}</span>
    <span class="sub">${lastSet ? 'zuletzt ' + esc(setText(lastSet.set, e.type)) : 'noch nie trainiert'}${last ? ' · ' + esc(dfShort.format(new Date(last.date))) : ''}</span></span>
    <span class="end">${vals.filter(fin).length > 1 ? Charts.spark(vals, { w: 64, h: 28 }) : ''}</span>${ICON.chev}
  </button>`;
}

function openEx(id) {
  curEx = id;
  nav('uebung');
}

function renderUebung() {
  const el = $('#view-uebung');
  const ex = exById(curEx);
  if (!ex) { nav('uebungen'); return; }
  $('#topSub').textContent = [ex.group, TYPE_LABEL[ex.type]].filter(Boolean).join(' · ');
  const b = Core.bests(db.sessions, ex);
  const pts = Core.inRange(b.points, range);
  const se = activeSession();
  const inSession = se && se.items.some((x) => x.exerciseId === ex.id);

  const segs = seg('range', [[90, '3 Monate'], [365, '1 Jahr'], [0, 'Alles']], range);
  let charts = '';
  if (pts.length < 2) {
    charts = `<div class="card"><div class="chart-empty">${b.points.length
      ? 'Zu wenig Trainings im Zeitraum. Wähle einen längeren.'
      : 'Noch kein Satz für diese Übung.'}</div></div>`;
  } else if (ex.type === 'weight') {
    charts = chartCard('Höchstgewicht', pts, b.points, 'top', (v) => nf0.format(v), 'kg')
      + chartCard('Geschätztes 1RM (Epley)', pts, b.points, 'rm', (v) => nf0.format(v), 'kg')
      + chartCard('Volumen je Training', pts, b.points, 'vol', (v) => nf0.format(v), 'kg', true);
  } else if (ex.type === 'bodyweight') {
    charts = chartCard('Meiste Wiederholungen', pts, b.points, 'reps', (v) => nf0.format(v), 'Wdh')
      + chartCard('Wiederholungen je Training', pts, b.points, 'vol', (v) => nf0.format(v), 'Wdh', true);
  } else {
    charts = chartCard('Längste Dauer', pts, b.points, 'secs', (v) => Core.clock(v), '')
      + chartCard('Zeit je Training', pts, b.points, 'vol', (v) => Core.clock(v), '', true);
  }

  el.innerHTML = `${segs}
    <div class="card">
      <div class="stats">${bestCells(ex, b)}</div>
      <p class="note">${esc(bestLine(ex, b))}</p>
    </div>
    ${charts}
    ${se ? `<button class="btn ${inSession ? '' : 'btn-primary'} btn-block" data-act="addcur">${inSession ? ICON.plus + 'Weiteren Satz loggen' : ICON.plus + 'Zum laufenden Training'}</button>` : ''}
    <div class="sec-h">Letzte Trainings</div>
    ${exSessionRows(ex, b)}
    <button class="btn btn-block" data-act="editex">${ICON.pencil}Übung bearbeiten</button>`;
}

/** Drei Bestwerte, je Typ die passenden. */
function bestCells(ex, b) {
  const cell = (lbl, val, unit) => `<div><span class="lbl">${esc(lbl)}</span><span class="num">${val}${unit ? `<small>${esc(unit)}</small>` : ''}</span></div>`;
  if (ex.type === 'time') {
    return cell('Bestzeit', b.secs ? esc(Core.clock(b.secs.v)) : '–', '')
      + cell('Zeit gesamt', b.total ? countNum(Math.round(b.total / 60)) : '0', 'min')
      + cell('Trainings', countNum(b.sessions), '');
  }
  if (ex.type === 'bodyweight') {
    return cell('Meiste Wdh', b.reps ? countNum(b.reps.v) : '–', '')
      + cell('Wdh gesamt', countNum(b.total), '')
      + cell('Trainings', countNum(b.sessions), '');
  }
  return cell('Bestgewicht', b.top ? countNum(b.top.v, b.top.v % 1 !== 0) : '–', 'kg')
    + cell('Bestes 1RM', b.rm ? countNum(b.rm.v) : '–', 'kg')
    + cell('Volumen', countNum(b.total), 'kg');
}

function bestLine(ex, b) {
  if (!b.sessions) return 'Noch kein Satz gespeichert.';
  const best = ex.type === 'time' ? b.secs : (ex.type === 'bodyweight' ? b.reps : b.top);
  const when = best ? dfMed.format(new Date(best.date)) : null;
  return `${plural(b.sets, 'Satz', 'Sätze')} in ${plural(b.sessions, 'Training', 'Trainings')}`
    + (when ? `, Bestwert am ${when}` : '')
    + `. Zuletzt am ${dfMed.format(new Date(b.last.date))}.`;
}

/** Ein Diagramm mit Einordnung darunter. `asBars` für Summen je Training. */
function chartCard(title, pts, all, key, fmtY, unit, asBars) {
  const vals = pts.map((p) => p[key]);
  const labels = pts.map((p) => dfAxis.format(new Date(p.date)));
  const svg = asBars
    ? Charts.bars(pts.map((p, i) => ({ label: labels[i], v: p[key] })), { fmtY })
    : Charts.line({ vals, labels, fmtY });
  const read = (i) => (pts[i] && fin(vals[i])
    ? `<b>${esc(fmtY(vals[i]))}</b>${unit ? ' ' + esc(unit) : ''} <span>${esc(dfMed.format(new Date(pts[i].date)))}</span>`
    : null);
  const tr = Core.trend(all, key, range);   // nicht pts: der Vergleichszeitraum liegt davor
  return `<div class="sec-h">${esc(title)}</div>
    <div class="card">${chartBox(svg, read, '<span>Antippen zum Ablesen</span>')}
      <p class="tr-text">${trendText(tr, fmtY, unit)}</p>
    </div>`;
}

/** Mittel im Zeitraum gegen den Zeitraum davor. Kleine Änderungen bleiben
    neutral, sonst stünde unter jedem Diagramm ein Urteil. */
function trendText(tr, fmtY, unit) {
  if (!tr) return 'Zu wenige Trainings für einen Vergleich.';
  const u = unit ? ' ' + esc(unit) : '';
  const same = Math.abs(tr.pct) < 3;
  const cls = same ? 'st-off' : (tr.diff > 0 ? 'st-good' : 'st-warn');
  const word = same ? 'etwa gleich wie davor'
    : `${nf0.format(Math.abs(tr.pct))} % ${tr.diff > 0 ? 'mehr' : 'weniger'} als davor`;
  return `Im Mittel <b>${esc(fmtY(tr.cur))}</b>${u} aus ${plural(tr.n, 'Training', 'Trainings')}, `
    + `davor ${esc(fmtY(tr.prev))}${u} – <b class="${cls}">${word}</b>.`;
}

function exSessionRows(ex, b) {
  const rows = b.points.slice(-6).reverse().map((p) => {
    const se = sessionById(p.id);
    const it = se && se.items.find((x) => x.exerciseId === ex.id);
    return `<button class="row row-wrap" data-act="session" data-id="${esc(p.id)}">
      <span class="grow"><span class="t">${esc(dfDay.format(new Date(p.date)))}</span>
      <span class="sub">${esc(it ? it.sets.map((s) => setText(s, ex.type)).join('  ·  ') : '')}</span></span>${ICON.chev}
    </button>`;
  }).join('');
  return rows ? `<div class="rows">${rows}</div>` : '<p class="note">Noch keine Trainings mit dieser Übung.</p>';
}

/** Übung anlegen. `then(id)` übernimmt die neue Übung, z. B. direkt ins
    laufende Training. */
function newExercise(then, back) {
  const groups = Array.from(new Set(db.exercises.map((e) => e.group).filter(Boolean)));
  openSheet('Neue Übung', `
    <label>Name<input id="f_name" autocomplete="off" placeholder="z. B. Beinpresse"></label>
    <label>Muskelgruppe<input id="f_group" autocomplete="off" list="grpList" placeholder="z. B. Beine">
      <datalist id="grpList">${groups.map((g) => `<option value="${esc(g)}"></option>`).join('')}</datalist></label>
    <div class="lbl">Art der Übung</div>
    ${seg('type', Core.TYPES.map((t) => [t, TYPE_LABEL[t]]), 'weight')}
    <p class="note">Gewicht: Hantel oder Maschine. Körpergewicht: Wiederholungen, optional mit Zusatzgewicht. Zeit: gehaltene Dauer.</p>
  `, () => {
    const name = $('#f_name').value.trim();
    if (!name) { toast('Name fehlt'); return; }
    const e = { id: uid(), name, group: $('#f_group').value.trim(), type: sheetSeg.type || 'weight', archived: false };
    db.exercises.push(e);
    save();
    closeSheet();
    render();
    toast('Übung angelegt');
    if (then) then(e.id);
  }, 'Anlegen');
  if (back) $('#sheetCancel').onclick = back;
  sheetSeg.type = 'weight';
  $('#sheetBody').onclick = (e) => {
    const s = e.target.closest('[data-seg="type"]');
    if (s) pickSeg('type', s);
  };
}

function editExercise(id, back) {
  const ex = exById(id);
  if (!ex) return;
  const groups = Array.from(new Set(db.exercises.map((e) => e.group).filter(Boolean)));
  const used = db.sessions.reduce((n, s) => n + (s.items.some((x) => x.exerciseId === id) ? 1 : 0), 0);
  const reopen = () => editExercise(id, back);
  openSheet('Übung bearbeiten', `
    <label>Name<input id="f_name" autocomplete="off" value="${esc(ex.name)}"></label>
    <label>Muskelgruppe<input id="f_group" autocomplete="off" list="grpList2" value="${esc(ex.group)}">
      <datalist id="grpList2">${groups.map((g) => `<option value="${esc(g)}"></option>`).join('')}</datalist></label>
    <div class="lbl">Art der Übung</div>
    ${seg('type', Core.TYPES.map((t) => [t, TYPE_LABEL[t]]), ex.type)}
    ${used ? `<p class="note">In ${plural(used, 'Training', 'Trainings')} erfasst. Ein anderer Typ ändert nur die Anzeige, gespeicherte Sätze bleiben.</p>` : ''}
    <button class="btn btn-block" id="f_arch">${ex.archived ? ICON.restore + 'Wieder aufnehmen' : ICON.archive + 'Archivieren'}</button>
    <button class="btn btn-danger btn-block" id="f_del">${ICON.trash}Übung löschen</button>
  `, () => {
    const name = $('#f_name').value.trim();
    if (!name) { toast('Name fehlt'); return; }
    ex.name = name;
    ex.group = $('#f_group').value.trim();
    ex.type = sheetSeg.type || ex.type;
    save(); closeSheet(); render(); toast('Gespeichert');
  });
  if (back) $('#sheetCancel').onclick = back;
  sheetSeg.type = ex.type;
  $('#sheetBody').onclick = (e) => {
    const s = e.target.closest('[data-seg="type"]');
    if (s) pickSeg('type', s);
  };
  $('#f_arch').onclick = () => {
    ex.archived = !ex.archived;
    save(); closeSheet();
    if (ex.archived && view === 'uebung') nav('uebungen'); else render();
    toast(ex.archived ? 'Archiviert' : 'Wieder dabei');
  };
  $('#f_del').onclick = () => askSheet('Übung löschen?',
    used ? `Die Übung steht in ${plural(used, 'Training', 'Trainings')}. Mit ihr verschwinden alle dort gespeicherten Sätze. Archivieren behält den Verlauf.`
      : 'Die Übung wird gelöscht.',
    'Löschen', () => {
      db.exercises = db.exercises.filter((x) => x.id !== id);
      db.sessions.forEach((s) => { s.items = s.items.filter((x) => x.exerciseId !== id); });
      save(); closeSheet();
      if (view === 'uebung') nav('uebungen'); else render();
      toast('Gelöscht');
    }, reopen, true);
}

/* ── 10. Ansicht Einstellungen, Backup ──────────────────────── */
function renderEinst() {
  const last = db.lastBackup ? dfMed.format(new Date(db.lastBackup)) : 'noch nie';
  const nState = !('Notification' in window) ? 'Von diesem Browser nicht unterstützt'
    : Notification.permission === 'granted' ? 'Erlaubt'
      : Notification.permission === 'denied' ? 'Abgelehnt – in den Browser-Einstellungen änderbar'
        : 'Noch nicht erlaubt';
  $('#topSub').textContent = '';
  $('#view-einst').innerHTML = `
    <div class="sec-h">Training</div>
    <button class="row card" data-act="restset">
      <span class="grow"><span class="t">Pausenzeit</span><span class="sub">Startet nach jedem gespeicherten Satz</span></span>
      <span class="end num">${esc(Core.clock(db.settings.restSeconds))}</span>${ICON.chev}
    </button>
    <div class="card">
      <div class="lbl">Gewicht in Schritten von</div>
      ${seg('step', [[1, '1 kg'], [1.25, '1,25 kg'], [2.5, '2,5 kg'], [5, '5 kg']], db.settings.weightStep)}
      <p class="note">Gilt für die Plus- und Minus-Knöpfe. Ins Feld lässt sich jeder Wert eintragen.</p>
    </div>
    <button class="row card" data-nav="uebungen">
      <span class="grow"><span class="t">Übungen verwalten</span><span class="sub">Anlegen, umbenennen, archivieren</span></span>
      <span class="end num">${nf0.format(db.exercises.filter((e) => !e.archived).length)}</span>${ICON.chev}
    </button>

    <div class="sec-h">Darstellung</div>
    <div class="card">${seg('theme', Object.keys(THEMES).map((k) => [k, THEMES[k].label]), db.settings.theme)}</div>

    <div class="sec-h">Benachrichtigung</div>
    <div class="card">
      <div class="lbl">Ende der Pause</div>
      <p class="note">${esc(nState)}. Bei gesperrtem Handy kann Android die Meldung verzögern – sicher ist nur die Leiste in der App.</p>
      ${('Notification' in window) && Notification.permission === 'default'
        ? '<button class="btn btn-block" data-act="notify">Benachrichtigung erlauben</button>' : ''}
    </div>

    <div class="sec-h">Backup</div>
    <div class="card">
      <p class="note">Deine Daten liegen nur auf diesem Gerät. „Browserdaten löschen" entfernt sie ohne Vorwarnung, deshalb regelmäßig ein Backup sichern. Letztes Backup: ${esc(last)}.</p>
      <button class="btn btn-block" data-act="export">Backup speichern</button>
      <button class="btn btn-block" data-act="import">Backup laden</button>
      <input type="file" id="fileImport" accept="application/json,.json" class="hidden">
      <p class="note">Alte Trainings aus einer Import-Datei kommen zu deinen Daten dazu, nichts wird ersetzt. Tage, an denen schon ein Training steht, werden übersprungen.</p>
      <button class="btn btn-block" data-act="merge">Alte Trainings hinzufügen</button>
      <input type="file" id="fileMerge" accept="application/json,.json" class="hidden">
    </div>

    <div class="sec-h">App</div>
    <div class="card">
      <button class="btn btn-block hidden" id="btnInstall" data-act="install">App installieren</button>
      <button class="btn btn-block" data-act="update">Nach Update suchen</button>
      <p class="note">Gymtracker ${esc(APP_VERSION)} · ${plural(db.sessions.length, 'Training', 'Trainings')}, ${plural(db.exercises.length, 'Übung', 'Übungen')}, ${plural(db.bodyWeights.length, 'Gewichtseintrag', 'Gewichtseinträge')}</p>
    </div>`;
  $('#fileImport').onchange = (e) => importBackup(e.target.files[0]);
  $('#fileMerge').onchange = (e) => mergeOld(e.target.files[0]);
  syncInstall();
}

function restSheet() {
  openSheet('Pausenzeit', `
    ${stepper('f_rest', 'Pause nach einem Satz', db.settings.restSeconds, REST_STEP, 's', 10)}
    <p class="note">Nach jedem gespeicherten Satz läuft die Pause von selbst. In der Leiste lässt sie sich jederzeit um ±${REST_STEP} s verschieben.</p>
  `, () => {
    const v = Math.max(10, Math.min(900, Math.round(num($('#f_rest').value))));
    db.settings.restSeconds = v;
    save(); closeSheet(); render(); toast(`Pause: ${Core.clock(v)}`);
  });
}

function exportBackup() {
  db.lastBackup = new Date().toISOString();
  save();
  /* Der gesamte Datensatz wandert unverändert in die Datei. `meta` steht nur
     als Kopfzeile davor und wird beim Import wieder entfernt (normalize).
     Geheimnisse liegen in eigenen Schlüsseln und kommen nie hier hinein. */
  const payload = Object.assign({
    meta: { app: 'Gymtracker', appVersion: APP_VERSION, format: db.v, exported: db.lastBackup },
  }, db);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gymtracker-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  render();
  toast('Backup gespeichert');
}

function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.exercises)) {
        throw new Error('Die Datei ist kein Backup dieser App.');
      }
      const stand = d.meta && d.meta.exported ? ` vom ${dfMed.format(new Date(d.meta.exported))}` : '';
      askSheet('Backup laden',
        `Das Backup${stand} enthält ${plural(d.sessions.length, 'Training', 'Trainings')} und ${plural(d.exercises.length, 'Übung', 'Übungen')}. `
        + 'Deine jetzigen Daten werden dabei ersetzt.',
        'Laden', () => {
          db = Core.normalize(d, { uid, themes: Object.keys(THEMES) });   // ergänzt Fehlendes, wirft `meta` weg
          applyTheme(db.settings.theme);
          save(); closeSheet();
          curEx = null;
          nav('heute');
          toast('Backup geladen');
        });
    } catch (e) { infoSheet('Import fehlgeschlagen', e.message); }
  };
  r.readAsText(file);
}

/** Alte Trainings dazuladen (Datei mit meta.kind "gym-merge"). Anders als
    das Backup ersetzt das nichts: Planung in Core.planMerge, hier nur
    Rückfrage und Übernahme. */
function mergeOld(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    $('#fileMerge').value = '';                    // dieselbe Datei soll erneut wählbar sein
    try {
      const plan = Core.planMerge(db, JSON.parse(r.result), uid);
      const skip = plan.skipped.length
        ? ` ${plan.skipped.length} ${plan.skipped.length === 1 ? 'Tag steht' : 'Tage stehen'} schon in der App und ${plan.skipped.length === 1 ? 'wird' : 'werden'} übersprungen.` : '';
      if (!plan.sessions.length) { infoSheet('Nichts hinzuzufügen', 'Alle Trainings aus der Datei stehen schon in der App.'); return; }
      const sets = plan.sessions.reduce((n, se) => n + se.items.reduce((m, it) => m + it.sets.length, 0), 0);
      const ex = plan.exercises.length
        ? ` Neu angelegt ${plan.exercises.length === 1 ? 'wird' : 'werden'}: ${plan.exercises.map((e) => e.name).join(', ')}.` : '';
      askSheet('Alte Trainings hinzufügen',
        `${plural(plan.sessions.length, 'Training', 'Trainings')} mit ${plural(sets, 'Satz', 'Sätzen')} ${plan.sessions.length === 1 ? 'kommt' : 'kommen'} dazu.${ex}${skip}`,
        'Hinzufügen', () => {
          db.exercises = db.exercises.concat(plan.exercises);
          db.sessions = db.sessions.concat(plan.sessions);
          db = Core.normalize(db, { uid, themes: Object.keys(THEMES) });   // sortiert den Verlauf neu
          save(); closeSheet(); render();
          toast(`${plural(plan.sessions.length, 'Training', 'Trainings')} hinzugefügt`);
        });
    } catch (e) { infoSheet('Import fehlgeschlagen', e.message); }
  };
  r.readAsText(file);
}

/* ── 11. Sheet und Dialoge ──────────────────────────────────── */
let sheetSaveFn = null;
/* Auswahl der Segmente im Sheet: ein Segment ist kein Formularfeld, sein
   Wert lässt sich beim Sichern nicht aus dem DOM lesen. */
const sheetSeg = {};

function openSheet(title, html, saveFn, saveLabel) {
  armBack();                              // Zurück soll das Sheet schließen, nicht die App
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetBody').onclick = null;         // Handler des vorherigen Sheets verwerfen
  $('#sheetCancel').onclick = closeSheet; // ggf. überschriebenes Abbrechen zurücksetzen
  sheetSaveFn = saveFn || null;
  const btn = $('#sheetSave');
  btn.classList.toggle('hidden', !saveFn);
  btn.textContent = saveLabel || 'Sichern';
  $('#sheet').classList.remove('hidden', 'sheet-tall');
  $('#scrim').classList.remove('hidden');
  $('#sheetBody').scrollTop = 0;
}

function closeSheet() {
  $('#sheet').classList.add('hidden');
  $('#scrim').classList.add('hidden');
  sheetSaveFn = null;
  for (const k of readers.keys()) if (k[0] === 's') readers.delete(k);
}

/* Ersatz für confirm() / prompt() / alert(): installierte Web-Apps
   unterdrücken die nativen Dialoge je nach Gerät kommentarlos (Regel 1).
   `back` führt zurück zum vorherigen Sheet statt alles zuzuklappen. */
function askSheet(title, text, okLabel, onOk, back, danger) {
  openSheet(title, `
    <p class="dlg-t">${esc(text)}</p>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" id="dlgOk">${esc(okLabel)}</button>
    <button class="btn btn-block" id="dlgNo">Abbrechen</button>
  `, null);
  const zurueck = () => (back ? back() : closeSheet());
  $('#dlgOk').onclick = onOk;
  $('#dlgNo').onclick = zurueck;
  $('#sheetCancel').onclick = zurueck;
}

function infoSheet(title, text, back) {
  openSheet(title, `
    <p class="dlg-t">${esc(text)}</p>
    <button class="btn btn-primary btn-block" id="dlgOk">Verstanden</button>
  `, null);
  const zurueck = () => (back ? back() : closeSheet());
  $('#dlgOk').onclick = zurueck;
  $('#sheetCancel').onclick = zurueck;
}

/* ── 12. Zurück-Taste ───────────────────────────────────────────
   Ohne Zutun beendet ein einziger Druck auf Zurück die installierte App.
   Deshalb liegt ein zusätzlicher Verlaufseintrag („Wächter") über der App:
   Zurück landet bei uns statt beim System. Der Druck schließt der Reihe
   nach, was offen ist (Sheet, Unterseite), und baut den Wächter wieder auf.
   Auf Heute fragt ein Dialog nach. Zusammenspiel ist fummelig und erprobt:
   nur mit Bedacht ändern. */
let guardUp = false;
let leaving = false;

function pushGuard() {
  if (guardUp) return;
  guardUp = true;
  try { history.pushState({ g: 1 }, ''); } catch (e) { guardUp = false; }
}

/** Vor allem, was die Zurück-Taste abfangen soll: Sheet öffnen, Seite wechseln. */
function armBack() { pushGuard(); }

/** „Verlassen" im Abschiedsdialog: der Dialog hat selbst einen Wächter
    aufgebaut. Erst ihn abräumen, dann führt der zweite Schritt aus der App.
    Beides über zwei Runden: history.back() zweimal hintereinander fasst der
    Browser zu einem Schritt zusammen. */
function leaveApp() {
  closeSheet();
  leaving = true;
  history.back();
}

function wireBack() {
  pushGuard();
  window.addEventListener('popstate', () => {
    guardUp = false;

    if (leaving) {
      leaving = false;
      history.back();
      // Bleiben wir doch hier (Browser-Tab ohne Vorgänger), fehlt der Wächter.
      // Kein Timer zum Nachrüsten: ein pushState würde das Verlassen abbrechen.
      document.addEventListener('pointerdown', pushGuard, { once: true });
      return;
    }
    // Über den Abbrechen-Knopf, nicht closeSheet: verschachtelte Sheets haben
    // dort ihren Rückweg zum vorherigen Sheet hinterlegt.
    if (!$('#sheet').classList.contains('hidden')) { $('#sheetCancel').click(); pushGuard(); return; }
    if (view === 'uebung') { nav('uebungen'); pushGuard(); return; }
    if (view !== 'heute') { nav('heute'); pushGuard(); return; }

    askSheet('App verlassen?', activeSession()
      ? 'Das Training läuft weiter und steht beim nächsten Start wieder da.'
      : 'Möchtest Du die App wirklich schließen?', 'Verlassen', leaveApp);
  });
}

/* ── 13. Updates, Installieren ──────────────────────────────── */
/** Welche APP_VERSION liegt im Offline-Cache? Das ist die Fassung, die beim
    nächsten Laden ausgeliefert wird, nicht zwingend die laufende. */
async function cachedVersion() {
  if (!('caches' in window)) return null;
  for (const k of await caches.keys()) {
    if (!k.startsWith('gym-')) continue;           // Caches der anderen Apps auf der Domain
    const c = await caches.open(k);
    const res = (await c.match('./app.js')) || (await c.match('app.js'));
    if (!res) continue;
    const m = (await res.text()).match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m) return m[1];
  }
  return null;
}

/** Lädt neu, wenn im Cache eine andere Fassung liegt als die laufende. Die
    Sperre in sessionStorage verhindert eine Endlosschleife, falls das
    Neuladen die Version wider Erwarten nicht ändert. */
let reloading = false;
async function applyIfNewer(announce) {
  if (reloading) return false;
  const cv = await cachedVersion();
  if (!cv || cv === APP_VERSION) return false;
  if (sessionStorage.getItem('gym.reload') === cv) return false;        // schon versucht
  if (!$('#sheet').classList.contains('hidden')) {                      // Formular offen
    toast(`Version ${cv} bereit: App neu starten`);
    return true;
  }
  reloading = true;
  sessionStorage.setItem('gym.reload', cv);
  if (announce) toast(`Version ${cv} wird geladen …`);
  setTimeout(() => location.reload(), announce ? 700 : 0);
  return true;
}

function wireUpdates() {
  if (!('serviceWorker' in navigator)) return;

  /* Auf 'controllerchange' ist kein Verlass: aktualisiert sich dieselbe
     Registrierung, bleibt das Ereignis aus. Verlässlich ist der
     Zustandswechsel des neuen Workers auf 'activated'. */
  const watch = (w) => {
    if (!w) return;
    if (w.state === 'activated') { applyIfNewer(false); return; }
    w.addEventListener('statechange', () => {
      if (w.state === 'activated') applyIfNewer(false);
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => applyIfNewer(false));

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      watch(reg.installing); watch(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      navigator.serviceWorker.ready.then(() => applyIfNewer(false));
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
}

/** Knopf „Nach Update suchen". Findet reg.update() eine neue Fassung,
    übernimmt der Wächter aus wireUpdates() das Neuladen. */
async function checkUpdate() {
  if (!('serviceWorker' in navigator)) { toast('Updates werden hier nicht unterstützt'); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.installing || reg.waiting) { toast('Update wird geladen …'); return; }
    }
  } catch (e) { /* offline: dann gilt der vorhandene Cache */ }
  if (!(await applyIfNewer(true))) toast(`Version ${APP_VERSION} ist aktuell`);
}

/* Eigener Installieren-Knopf statt Chrome-Menü: Chrome 154 bis 157 meldet dort
   „bereits installiert", sobald irgendeine andere App auf derselben Domain
   installiert ist (crbug.com/568841400). beforeinstallprompt prüft pro App.
   Chrome schickt das Ereignis nur, solange die App installierbar ist; der
   Knopf verschwindet also von selbst. */
let installEvt = null;

/** Knopf ein- oder ausblenden. Das Ereignis kommt oft erst ein paar Sekunden
    nach dem Laden, unter Umständen bei schon offener Einstellungsansicht. */
function syncInstall() {
  const b = $('#btnInstall');
  if (b) b.classList.toggle('hidden', !installEvt);
}

function wireInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();             // keine eigene Leiste von Chrome, der Knopf reicht
    installEvt = e;
    syncInstall();
  });
  window.addEventListener('appinstalled', () => {
    installEvt = null;
    syncInstall();
    toast('Gymtracker ist installiert');
  });
}

async function installApp() {
  const e = installEvt;
  if (!e) return;
  installEvt = null;                // prompt() geht nur einmal pro Ereignis
  syncInstall();
  e.prompt();
  await e.userChoice.catch(() => {});
}

/* ── 14. Diagramme ablesen, Bausteine ───────────────────────── */
/** Diagramm in einen Kasten mit Ablesezeile setzen. reader(i) liefert HTML
    für Punkt i oder null. scope 's' für Diagramme im Sheet. */
function chartBox(svg, reader, initial, scope) {
  const id = (scope || 'v') + (++rid);
  if (reader) readers.set(id, reader);
  return `<div class="chart" data-cid="${id}"><div class="readout">${initial || ''}</div>${svg}</div>`;
}

function onChartPointer(e) {
  const svg = e.target.closest && e.target.closest('.chart svg[data-n]');
  if (!svg) return;
  const box = svg.closest('.chart');
  const fn = readers.get(box.dataset.cid);
  if (!fn) return;
  const r = svg.getBoundingClientRect();
  const vbw = svg.viewBox.baseVal.width || 340;
  const x = ((e.clientX - r.left) / r.width) * vbw;
  const n = +svg.dataset.n, x0 = +svg.dataset.x0, x1 = +svg.dataset.x1;
  const i = Math.max(0, Math.min(n - 1, Math.floor(((x - x0) / (x1 - x0)) * n)));
  const html = fn(i);
  if (html == null) return;
  box.querySelector('.readout').innerHTML = html;
  const c = svg.querySelector('.cursor');
  if (c) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / n;
    c.setAttribute('x1', cx); c.setAttribute('x2', cx);
    c.classList.remove('hidden');
  }
}

/** Segmented Control für 2 bis 5 feste Optionen. */
const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v, l]) =>
  `<button data-seg="${esc(name)}" data-v="${esc(v)}" class="${String(v) === String(cur) ? 'on' : ''}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;

/** Auswahl eines Segments im Sheet übernehmen (Zustand in sheetSeg). */
function pickSeg(name, btn) {
  sheetSeg[name] = btn.dataset.v;
  $$(`[data-seg="${name}"]`, $('#sheetBody')).forEach((b) => {
    const on = b === btn;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/** Zahl mit −/+ und freiem Feld. Das Feld bleibt eine Texteingabe: eine
    Zahleneingabe verwirft auf dem Handy das deutsche Komma. */
function stepper(id, label, value, step, unit, min) {
  const v = fin(value) ? nfa.format(value) : '';
  return `<div class="lbl">${esc(label)}</div>
  <div class="step">
    <button class="step-b" data-step="${esc(id)}:-${step}" aria-label="${esc(label)} verringern">${ICON.minus}</button>
    <span class="step-f"><input id="${esc(id)}" class="step-in num" type="text" inputmode="decimal"
      autocomplete="off" data-min="${min || 0}" data-step="${step}" value="${esc(v)}" aria-label="${esc(label)}">
      ${unit ? `<span class="step-u">${esc(unit)}</span>` : ''}</span>
    <button class="step-b" data-step="${esc(id)}:${step}" aria-label="${esc(label)} erhöhen">${ICON.plus}</button>
  </div>`;
}

/** Klick auf −/+ eines Steppers: `spec` ist „feldId:schritt". */
function bumpStep(spec) {
  const i = spec.lastIndexOf(':');
  const el = $('#' + spec.slice(0, i));
  if (!el) return;
  const d = num(spec.slice(i + 1).replace('-', '')) * (spec.slice(i + 1)[0] === '-' ? -1 : 1);
  const min = +el.dataset.min || 0;
  // Auf ein Vielfaches des Schritts einrasten, damit aus 41 kg nicht 42,25 wird
  const cur = num(el.value);
  let v = Math.abs(d) > 0 ? (d > 0 ? Math.floor(cur / d + 1e-9) * d + d : Math.ceil(cur / -d - 1e-9) * -d + d) : cur;
  v = Math.max(min, Math.round(v * 100) / 100);
  el.value = nfa.format(v);
}

/* ── 15. Verdrahten, Start ──────────────────────────────────── */
/** Sheet über der Bildschirmtastatur halten. Android legt die Tastatur über
    die Seite, ein unten festgemachtes Sheet läge dann mit Suchtreffern und
    Knöpfen darunter. visualViewport kennt den sichtbaren Teil: das Sheet
    rückt um die Tastaturhöhe hoch und wird nie höher als der Rest. */
function wireKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  const fit = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    root.setProperty('--kb', kb + 'px');
    root.setProperty('--vvh', Math.round(vv.height) + 'px');
    document.body.classList.toggle('kb-open', kb > 80);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  fit();
}

/** Klicks per Delegation am body, nicht einzeln pro gerenderter Zeile.
    Klicks im Sheet behandelt das Sheet selbst (#sheetBody.onclick), nur die
    Stepper laufen überall gleich. */
function wire() {
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#sheet')) return;
    const r = e.target.closest('[data-rest]');
    if (r) { const v = +r.dataset.rest; if (v) addRest(v); else skipRest(); return; }
    const n = e.target.closest('[data-nav]'); if (n) { nav(n.dataset.nav); return; }
    const s = e.target.closest('[data-seg]'); if (s) { onSeg(s.dataset.seg, s.dataset.v); return; }
    const a = e.target.closest('[data-act]'); if (a) { viewAct(a); return; }
  });
  $('#sheet').addEventListener('click', (e) => {
    const st = e.target.closest('button[data-step]');
    if (st) bumpStep(st.dataset.step);
  });
  // Diagramme ablesen: Antippen und Ziehen mit dem Finger, mit der Maus schon beim Drüberfahren
  document.addEventListener('pointerdown', onChartPointer);
  document.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') onChartPointer(e); });
  $('#btnBack').onclick = () => nav('uebungen');
  $('#btnNew').onclick = () => newExercise();
  $('#sheetCancel').onclick = closeSheet;
  $('#scrim').onclick = () => $('#sheetCancel').click();   // wie Abbrechen, mit Rückweg verschachtelter Sheets
  $('#sheetSave').onclick = () => sheetSaveFn && sheetSaveFn();

  /* Zurück aus dem Hintergrund: die Pause ist weitergelaufen (Endzeit als
     Zeitstempel), die Bildschirmsperre hat der Browser zurückgenommen. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (db.active) wake(true);
    if (db.rest && restLeft() <= 0) restDone(true); else renderRest();
  });
}

/** Segmente in den Ansichten (im Sheet läuft die Auswahl über pickSeg). */
function onSeg(name, v) {
  if (name === 'range') { range = +v; animNext = true; render(); return; }
  if (name === 'theme') { applyTheme(v); save(); render(); return; }
  if (name === 'step') { db.settings.weightStep = num(v); save(); render(); }
}

function viewAct(el) {
  const act = el.dataset.act;
  const ex = el.dataset.ex;
  if (act === 'start') startSession();
  else if (act === 'end') endSession();
  else if (act === 'addex') pickExercise(db.active);
  else if (act === 'logset') openSetSheet(db.active, ex);
  else if (act === 'editset') openSetSheet(db.active, ex, +el.dataset.i);
  else if (act === 'exsets') setsSheet(db.active, ex);
  else if (act === 'note') noteSheet(db.active);
  else if (act === 'extra') toggleExtra(db.active, el.dataset.v);
  else if (act === 'session') openSessionSheet(el.dataset.id);
  else if (act === 'ex') openEx(el.dataset.id);
  else if (act === 'newex') newExercise();
  else if (act === 'editex') editExercise(curEx);
  else if (act === 'addcur') {
    const se = activeSession();
    if (!se) return;
    itemOf(se, curEx, true); save();
    openSetSheet(se.id, curEx);
  } else if (act === 'bwadd') bodyWeightSheet();
  else if (act === 'bwlist') bodyWeightList();
  else if (act === 'restset') restSheet();
  else if (act === 'notify') { askNotify(); setTimeout(render, 600); }
  else if (act === 'export') exportBackup();
  else if (act === 'import') $('#fileImport').click();
  else if (act === 'merge') $('#fileMerge').click();
  else if (act === 'install') installApp();
  else if (act === 'update') checkUpdate();
}

load();
applyTheme(db.settings.theme);
/* Eine Pause, die während der App-Pause abgelaufen ist, ist Geschichte:
   still verwerfen, nicht nachträglich meldenueber. */
if (db.rest && restLeft() <= 0) { db.rest = null; save(); }
wire();
wireKeyboard();
wireBack();
nav(restoreViewState());
if (db.active) wake(true);

/* Bittet den Browser, den Speicher nicht bei Platzmangel wegzuräumen. */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

wireUpdates();
wireInstall();
