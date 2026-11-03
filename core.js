'use strict';
/* ═══════════════════════════════════════════════════════════════
   Gymtracker: Datenmodell und Auswertung ohne DOM

   Hier steht alles, was sich rechnen lässt, ohne den Bildschirm zu
   kennen: Grundstruktur, Normalisieren fremder Daten, Kennzahlen je
   Übung, Bestwerte, Einordnung. app.js zeichnet, core.js rechnet.
   Dadurch läuft die Auswertung in Node unter Test (tests/core-test.js).

   Aufbau:
   1. Typen, Startliste
   2. Helfer
   3. Grundstruktur und Normalisieren
   4. Ein Satz, eine Einheit
   5. Serien je Übung, Bestwerte
   6. Einordnung, Wochen
   ═══════════════════════════════════════════════════════════════ */

const Core = (() => {

/* ── 1. Typen, Startliste ───────────────────────────────────── */
/** Übungstypen. `weight`: Gewicht und Wdh. `bodyweight`: Wdh, optional
    Zusatzgewicht. `time`: gehaltene Dauer in Sekunden. */
const TYPES = ['weight', 'bodyweight', 'time'];

/* Übungen, die bisher in den Notizen standen. Feste, sprechende ids:
   sie stehen in jeder Einheit und sollen auch in einem alten Backup
   noch dieselbe Übung treffen. */
const SEED = [
  { id: 'bizeps',     name: 'Bizeps',                     group: 'Arme',       type: 'weight' },
  { id: 'bank-frei',  name: 'Bankdrücken frei',           group: 'Brust',      type: 'weight' },
  { id: 'bank-gef',   name: 'Bankdrücken geführt',        group: 'Brust',      type: 'weight' },
  { id: 'cross-fly',  name: 'Cross Butterfly (Kabelturm)', group: 'Brust',     type: 'weight' },
  { id: 'butterfly',  name: 'Butterfly',                  group: 'Brust',      type: 'weight' },
  { id: 'schulter',   name: 'Schulter',                   group: 'Schultern',  type: 'weight' },
  { id: 'bauch',      name: 'Bauch',                      group: 'Rumpf',      type: 'weight' },
  { id: 'klimmzuege', name: 'Klimmzüge',                  group: 'Rücken',     type: 'bodyweight' },
  { id: 'iso-row',    name: 'ISO Lateral Row',            group: 'Rücken',     type: 'weight' },
  { id: 'deadhang',   name: 'Deadhang',                   group: 'Griffkraft', type: 'time' },
];

/* ── 2. Helfer ──────────────────────────────────────────────── */
const fin = (v) => typeof v === 'number' && isFinite(v);
const r2 = (v) => Math.round(v * 100) / 100;

/** Zahl aus fremden Daten: nur positive, endliche Werte, sonst null. */
function posOrNull(v) {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return fin(n) && n > 0 ? r2(n) : null;
}

/** Sekunden als m:ss (Pausentimer, Deadhang). Unter einer Minute ohne
    Doppelpunkt, damit „45 s" nicht als „0:45" erscheint. */
function clock(s) {
  if (!fin(s)) return '–';
  s = Math.max(0, Math.round(s));
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

/** Geschätztes Einermaximum nach Epley. Die Formel gilt ab zwei
    Wiederholungen; bei einer ist das Gewicht selbst schon das Maximum,
    sonst schriebe die Schätzung 3 % dazu, die nie gehoben wurden. */
function epley(weight, reps) {
  if (!fin(weight) || !fin(reps) || weight <= 0 || reps <= 0) return null;
  if (reps <= 1) return r2(weight);
  return r2(weight * (1 + reps / 30));
}

const dayMs = 86400000;
const t0 = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };

/* ── 3. Grundstruktur und Normalisieren ─────────────────────── */
/** Frische Grundstruktur. Basis beim Laden und beim Backup-Import, damit
    später ergänzte Felder in alten Daten nicht fehlen. */
function blank() {
  return {
    v: 1,
    exercises: SEED.map((e) => ({                 // {id, name, group, type, archived}
      id: e.id, name: e.name, group: e.group, type: e.type, archived: false,
    })),
    sessions: [],        // {id, date (ISO), end (ISO|null), note, extras[], items[{exerciseId, sets[]}]}
    settings: {
      restSeconds: 90,   // Pausenlänge nach einem Satz
      weightStep: 1.25,  // Schrittweite der Plus/Minus-Knöpfe in kg
      theme: 'dark',
    },
    active: null,        // id der laufenden Einheit, sonst null
    rest: null,          // laufende Pause: {endsAt (ms), total (s)} – Endzeit, kein Restwert
    lastBackup: null,
  };
}

/** Ein Satz: je Typ sind andere Felder gefüllt, der Rest bleibt null.
    reps/weight für `weight`, reps/extra für `bodyweight`, seconds für `time`. */
function cleanSet(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {
    reps: posOrNull(s.reps),
    weight: posOrNull(s.weight),
    seconds: posOrNull(s.seconds),
    extra: posOrNull(s.extra),
  };
  // Ein Satz ohne jede Zahl ist kein Satz
  if (out.reps == null && out.seconds == null && out.weight == null) return null;
  return out;
}

/** Fremden Datensatz (localStorage oder Backup) auf die aktuelle Struktur
    bringen. Object.assign allein reicht nicht: es ersetzt verschachtelte
    Objekte im Ganzen, ein älteres `settings` ohne ein neues Feld würde die
    Vorgabe also löschen statt sie zu ergänzen. Daten haben Vorrang vor
    Vorgabe, kaputte Werte fallen auf die Vorgabe zurück.
    `opts`: { uid, themes } – uid erzeugt fehlende ids. */
function normalize(src, opts) {
  opts = opts || {};
  let seq = 0;
  const uid = opts.uid || (() => 'x' + (++seq) + '-' + Math.random().toString(36).slice(2, 7));
  const themes = opts.themes || ['dark', 'light'];
  const base = blank();
  const d = Object.assign(blank(), src || {});
  delete d.meta;                                  // Kopfdaten des Backups gehören nicht in die Daten

  const s = Object.assign({}, base.settings, (src && src.settings) || {});
  const rest = posOrNull(s.restSeconds);
  s.restSeconds = rest == null ? base.settings.restSeconds : Math.min(900, Math.max(10, Math.round(rest)));
  const step = posOrNull(s.weightStep);
  s.weightStep = step == null ? base.settings.weightStep : Math.min(25, step);
  if (themes.indexOf(s.theme) < 0) s.theme = base.settings.theme;
  d.settings = s;

  const ids = new Set();
  d.exercises = (Array.isArray(d.exercises) ? d.exercises : [])
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      let id = String(e.id || '').trim() || uid();
      while (ids.has(id)) id = uid();             // doppelte ids trennen, sonst mischen sich Verläufe
      ids.add(id);
      return {
        id,
        name: String(e.name == null ? '' : e.name).trim() || 'Übung',
        group: String(e.group == null ? '' : e.group).trim(),
        type: TYPES.indexOf(e.type) >= 0 ? e.type : 'weight',
        archived: !!e.archived,
      };
    });

  const sids = new Set();
  d.sessions = (Array.isArray(d.sessions) ? d.sessions : [])
    .filter((se) => se && typeof se === 'object')
    .map((se) => {
      let id = String(se.id || '').trim() || uid();
      while (sids.has(id)) id = uid();
      sids.add(id);
      const date = isFinite(Date.parse(se.date)) ? new Date(se.date).toISOString() : new Date().toISOString();
      const items = (Array.isArray(se.items) ? se.items : [])
        .filter((it) => it && typeof it === 'object' && it.exerciseId)
        .map((it) => ({
          exerciseId: String(it.exerciseId),
          sets: (Array.isArray(it.sets) ? it.sets : []).map(cleanSet).filter(Boolean),
        }))
        // Übungen, die es nicht mehr gibt, würden als leere Zeile stehen bleiben
        .filter((it) => ids.has(it.exerciseId));
      return {
        id,
        date,
        end: isFinite(Date.parse(se.end)) ? new Date(se.end).toISOString() : null,
        note: String(se.note == null ? '' : se.note),
        extras: Array.isArray(se.extras) ? se.extras.map(String) : [],
        items,
      };
    })
    .sort((a, b) => t0(b.date) - t0(a.date));     // neueste zuerst, wie die Verlaufsliste

  // Eine laufende Einheit, die es nicht mehr gibt, würde die Ansicht „Heute" blockieren
  if (!d.sessions.some((se) => se.id === d.active)) d.active = null;

  const end = d.rest && posOrNull(d.rest.endsAt);
  d.rest = end ? { endsAt: Math.round(end), total: posOrNull(d.rest.total) || base.settings.restSeconds } : null;
  d.v = 1;
  return d;
}

/* ── 4. Ein Satz, eine Einheit ──────────────────────────────── */
/** Volumen eines Satzes in kg: nur bei `weight` sinnvoll, bei
    Körpergewicht fehlt die eigene Masse, bei Zeit gibt es keine Wdh. */
function setVolume(set, type) {
  if (type !== 'weight') return 0;
  return fin(set.reps) && fin(set.weight) ? set.reps * set.weight : 0;
}

/** Zusammenfassung einer Einheit. `types`: id → Typ der Übung. */
function sessionStats(session, types) {
  types = types || {};
  let sets = 0, volume = 0, reps = 0, seconds = 0;
  (session.items || []).forEach((it) => {
    const type = types[it.exerciseId] || 'weight';
    it.sets.forEach((st) => {
      sets++;
      volume += setVolume(st, type);
      if (fin(st.reps)) reps += st.reps;
      if (fin(st.seconds)) seconds += st.seconds;
    });
  });
  const dur = session.end ? Math.max(0, t0(session.end) - t0(session.date)) / 1000 : null;
  return { sets, volume: r2(volume), reps, seconds, exercises: (session.items || []).length, dur };
}

/** Letzter gespeicherter Satz einer Übung, über alle Einheiten hinweg.
    Füllt das Formular vor: erst der letzte Satz von heute, sonst der
    letzte aus dem jüngsten Training mit dieser Übung. `skipId` lässt die
    laufende Einheit weg. */
function lastSet(sessions, exId, skipId) {
  const list = sessions.slice().sort((a, b) => t0(b.date) - t0(a.date));
  for (const se of list) {
    if (skipId && se.id === skipId) continue;
    const it = (se.items || []).find((x) => x.exerciseId === exId);
    if (it && it.sets.length) return { set: it.sets[it.sets.length - 1], date: se.date };
  }
  return null;
}

/* ── 5. Serien je Übung, Bestwerte ──────────────────────────── */
/** Ein Punkt je Einheit, in der die Übung vorkommt, aufsteigend nach Datum.
    - top:  schwerstes Gewicht der Einheit
    - vol:  Volumen (kg) bzw. Gesamt-Wdh bzw. Gesamtzeit
    - rm:   bestes geschätztes 1RM (Epley)
    - reps: meiste Wdh in einem Satz
    - secs: längste gehaltene Dauer */
function exercisePoints(sessions, exId, type) {
  const out = [];
  sessions.slice().sort((a, b) => t0(a.date) - t0(b.date)).forEach((se) => {
    const it = (se.items || []).find((x) => x.exerciseId === exId);
    if (!it || !it.sets.length) return;
    let top = null, rm = null, reps = null, secs = null, vol = 0;
    it.sets.forEach((st) => {
      const w = type === 'bodyweight' ? st.extra : st.weight;
      if (fin(w) && (top == null || w > top)) top = w;
      if (fin(st.reps) && (reps == null || st.reps > reps)) reps = st.reps;
      if (fin(st.seconds) && (secs == null || st.seconds > secs)) secs = st.seconds;
      const e = type === 'weight' ? epley(st.weight, st.reps) : null;
      if (e != null && (rm == null || e > rm)) rm = e;
      if (type === 'weight') vol += setVolume(st, type);
      else if (type === 'bodyweight') vol += fin(st.reps) ? st.reps : 0;
      else vol += fin(st.seconds) ? st.seconds : 0;
    });
    out.push({ t: t0(se.date), date: se.date, id: se.id, sets: it.sets.length, top, rm, reps, secs, vol: r2(vol) });
  });
  return out;
}

/** Bestwerte einer Übung über alle Einheiten, jeweils mit Datum. */
function bests(sessions, ex) {
  const pts = exercisePoints(sessions, ex.id, ex.type);
  const pick = (key) => {
    let best = null;
    pts.forEach((p) => { if (fin(p[key]) && (!best || p[key] > best.v)) best = { v: p[key], date: p.date }; });
    return best;
  };
  let total = 0, setCount = 0;
  pts.forEach((p) => { total += p.vol; setCount += p.sets; });
  return {
    points: pts,
    sessions: pts.length,
    sets: setCount,
    total: r2(total),
    last: pts.length ? pts[pts.length - 1] : null,
    top: pick('top'), rm: pick('rm'), reps: pick('reps'), secs: pick('secs'),
  };
}

/* ── 6. Einordnung, Wochen ──────────────────────────────────── */
/** Punkte eines Zeitraums. `days` = 0 bedeutet „alles". */
function inRange(points, days, now) {
  if (!days) return points.slice();
  const from = (now || Date.now()) - days * dayMs;
  return points.filter((p) => p.t >= from);
}

/** Mittel einer Kennzahl im Zeitraum gegen den Zeitraum davor. Für den
    Satz unter dem Diagramm. Bei „alles" wird die vorhandene Spanne
    halbiert, sonst gäbe es kein „davor". Nur mit mindestens zwei Punkten
    je Hälfte, damit ein einzelnes Training keinen Trend behauptet. */
function trend(points, key, days, now) {
  now = now || Date.now();
  let cutA, cutB;
  if (days) { cutA = now - days * dayMs; cutB = cutA - days * dayMs; }
  else {
    if (!points.length) return null;
    cutB = points[0].t - 1;
    cutA = cutB + (now - cutB) / 2;
  }
  const mean = (lo, hi) => {
    const vs = points.filter((p) => p.t >= lo && p.t < hi && fin(p[key])).map((p) => p[key]);
    return vs.length ? { v: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length } : null;
  };
  const cur = mean(cutA, now + 1), prev = mean(cutB, cutA);
  if (!cur || !prev || cur.n < 2 || prev.n < 2) return null;
  const diff = cur.v - prev.v;
  return { cur: r2(cur.v), prev: r2(prev.v), diff: r2(diff), pct: r2((diff / prev.v) * 100), n: cur.n, nPrev: prev.n };
}

/** Montag 00:00 der Woche eines Zeitpunkts (lokale Zeit). */
function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Die letzten `weeks` Wochen als Balken: Trainings, Sätze, Volumen.
    `cur` markiert die laufende Woche (noch nicht fertig, Regel „Unfertiges
    wird nicht bewertet"). */
function weekBuckets(sessions, weeks, types, now) {
  now = now || Date.now();
  const out = [];
  /* Rückwärts in Kalenderwochen, nicht in Millisekunden: die Zeitumstellung
     verschiebt eine Woche um eine Stunde, und 7 × 86400000 ms landen dann im
     Vortag – eine Woche fiele aus der Reihe. */
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(weekStart(now));
    d.setDate(d.getDate() - i * 7);
    d.setHours(0, 0, 0, 0);
    out.push({ start: d.getTime(), sessions: 0, sets: 0, volume: 0, cur: i === 0 });
  }
  const idx = new Map(out.map((b, i) => [b.start, i]));
  sessions.forEach((se) => {
    const i = idx.get(weekStart(t0(se.date)));
    if (i == null) return;
    const st = sessionStats(se, types);
    out[i].sessions++;
    out[i].sets += st.sets;
    out[i].volume = r2(out[i].volume + st.volume);
  });
  return out;
}

/** id → Typ, für sessionStats und weekBuckets. */
const typeMap = (exercises) => {
  const m = {};
  (exercises || []).forEach((e) => { m[e.id] = e.type; });
  return m;
};

return {
  TYPES, SEED, blank, normalize, cleanSet, clock, epley, posOrNull,
  setVolume, sessionStats, lastSet, exercisePoints, bests,
  inRange, trend, weekStart, weekBuckets, typeMap,
};
})();

if (typeof module === 'object' && module.exports) module.exports = Core;
