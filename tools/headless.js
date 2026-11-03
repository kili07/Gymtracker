#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════
   Prüf-Runde ohne Browser-Pane.

   Die Schnipsel in overflow.js, kontrast.js und dialoge-install.js sind
   zum Einfügen in die Browser-Konsole gedacht. Wer keinen Browser-Pane
   hat (Hintergrund-Sitzung, Server ohne Oberfläche), lässt sie hiermit
   in Chrome headless laufen: das Skript baut eine Prüfseite, die die App
   in einem iframe mit 375 px Breite lädt, die Ansichten und Sheets
   durchklickt und die Ergebnisse ausgibt.

   Voraussetzung: `python3 -m http.server 8123` läuft im Projektordner
   und `google-chrome` ist installiert.

   Aufruf:
     node tools/headless.js            → Layout und Kontrast, beide Themes
     node tools/headless.js --dialoge  → Löschwege, Installieren-Knopf, Zurück-Taste
     node tools/headless.js --hell     → nur helles Theme

   Grenzen: headless gilt als `document.hidden`, Animationen laufen dort
   nicht (Regel 12 sorgt dafür, dass die Endwerte trotzdem im HTML stehen).
   Was nur am Handy prüfbar ist, steht in DECISIONS.md unter „Offen".
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PORT = process.env.PORT || 8123;
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const dialoge = args.includes('--dialoge');
const themes = args.includes('--hell') ? ['light'] : dialoge ? ['dark'] : ['dark', 'light'];

/* Datensatz eines Jahres aus tests/daten.js: seitliches Scrollen zeigt sich
   erst bei langen Namen und sechsstelligem Volumen, nicht bei drei Einträgen. */
function datensatz(theme) {
  const out = execFileSync('node', [path.join(ROOT, 'tests/daten.js'), '--ls'], { encoding: 'utf8' });
  const m = out.match(/setItem\('gym\.v1', (".*")\); location/s);
  if (!m) throw new Error('tests/daten.js --ls liefert keine erkennbare Zeile');
  const db = JSON.parse(JSON.parse(m[1]));
  db.settings.theme = theme;        // app.js setzt das Theme beim Laden aus den Einstellungen
  return JSON.stringify(db);
}

const PRUEFER = `
function overflow(w){
  return [].slice.call(w.document.querySelectorAll('body *'))
    .filter(function(e){ var r = e.getBoundingClientRect(); return r.width && r.right > w.innerWidth + 1; })
    .filter(function(e){ return !e.closest('.chips'); })
    .slice(0, 10)
    .map(function(e){ return e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right); });
}
function kontrast(w){
  var d = w.document;
  function lum(c){
    var p = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(function(v){
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2];
  }
  function tok(n){ var e = d.createElement('div'); e.style.color = 'var(' + n + ')';
    d.body.appendChild(e); var c = getComputedStyle(e).color; e.remove(); return c; }
  function ratio(a,b){ var v = [lum(tok(a)), lum(tok(b))].sort(function(p,q){ return q-p; });
    return +(((v[0]+0.05)/(v[1]+0.05)).toFixed(2)); }
  var o = {};
  ['--text','--text-2','--muted','--accent','--st-low','--st-mid','--st-high']
    .forEach(function(t){ o[t] = ratio(t, '--surface'); });
  return o;
}
/* Touch-Ziele unter 44 px. Ein ::after mit negativem inset vergrößert die
   Trefferfläche (.chip macht das bewusst) und wird mitgerechnet. */
function kleineZiele(w){
  return [].slice.call(w.document.querySelectorAll('button, a[href], input, select, [data-act], [data-nav]'))
    .filter(function(e){
      if (e.closest('.hidden')) return false;
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var h = r.height, b = r.width;
      ['::after','::before'].forEach(function(ps){
        var cs = getComputedStyle(e, ps);
        if (cs.content === 'none' || cs.position !== 'absolute') return;
        h = Math.max(h, r.height - (parseFloat(cs.top)||0) - (parseFloat(cs.bottom)||0));
        b = Math.max(b, r.width - (parseFloat(cs.left)||0) - (parseFloat(cs.right)||0));
      });
      return b < 44 || h < 44;
    })
    .map(function(e){ var r = e.getBoundingClientRect();
      return e.tagName + '.' + (e.className || '-') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) + '"'; })
    .filter(function(s, i, a){ return a.indexOf(s) === i; }).slice(0, 12);
}`;

const LAYOUT = `
  log('theme=' + THEME + ' html[data-theme]=' + d.documentElement.getAttribute('data-theme'));
  log('kontrast auf --surface: ' + JSON.stringify(kontrast(w)));
  var tabs = [['heute','Heute'],['verlauf','Verlauf'],['uebungen','Übungen'],['einst','Einstellungen']];
  for (var i = 0; i < tabs.length; i++){
    var b = d.querySelector('[data-nav="' + tabs[i][0] + '"]');
    if (!b) { log('### ' + tabs[i][1] + ': Tab fehlt!'); continue; }
    b.click(); await wait(250); pruefe(w, tabs[i][1]);
  }
  d.querySelector('[data-nav="uebungen"]').click(); await wait(200);
  var row = d.querySelector('#view-uebungen [data-act="ex"], #view-uebungen [data-ex]');
  if (row) { row.click(); await wait(400); pruefe(w, 'Übung-Unterseite (' + (d.getElementById('viewTitle')||{}).textContent + ')'); }
  else log('### Übung-Unterseite: keine anklickbare Zeile');
  d.querySelector('[data-nav="heute"]').click(); await wait(200);
  var st = d.querySelector('#view-heute [data-act="start"]');
  if (st) { st.click(); await wait(400); pruefe(w, 'Heute mit laufendem Training'); }
  async function sheetAuf(sel, name, wo){
    var el = d.querySelector((wo || '') + ' ' + sel);
    if (!el) { log('### ' + name + ': ' + sel + ' nicht gefunden'); return; }
    el.click(); await wait(400);
    log('### Sheet "' + ((d.getElementById('sheetTitle')||{}).textContent||'') + '" offen='
      + !d.getElementById('sheet').classList.contains('hidden'));
    pruefe(w, name);
  }
  await sheetAuf('[data-act="addex"]', 'Sheet Übung wählen', '#view-heute');
  var erste = d.querySelector('#sheetBody [data-pick]');
  if (erste) { erste.click(); await wait(450); pruefe(w, 'Sheet Satz loggen');
    var sv = d.getElementById('sheetSave');
    if (sv) { sv.click(); await wait(500);
      log('### Pausenleiste sichtbar=' + !d.getElementById('restbar').classList.contains('hidden'));
      pruefe(w, 'Heute mit Satz und laufender Pause'); } }
  d.getElementById('sheetCancel').click(); await wait(250);
  await sheetAuf('[data-act="note"]', 'Sheet Notiz', '#view-heute');
  d.getElementById('sheetCancel').click(); await wait(250);
  d.querySelector('[data-nav="einst"]').click(); await wait(250);
  await sheetAuf('[data-act="restset"]', 'Sheet Pausenzeit', '#view-einst');
  d.getElementById('sheetCancel').click(); await wait(250);
  /* Pausenleiste über der Tableiste: darf sich nicht überlappen (--rest-h, --tab-h). */
  var rb = d.getElementById('restbar'), tb = d.getElementById('tabbar');
  if (rb && !rb.classList.contains('hidden')) {
    var r = rb.getBoundingClientRect(), t = tb.getBoundingClientRect();
    log('### Pausenleiste ' + Math.round(r.top) + '–' + Math.round(r.bottom)
      + ', Tableiste ' + Math.round(t.top) + '–' + Math.round(t.bottom)
      + ' → ' + (r.bottom <= t.top + 1 ? 'kein Ueberlappen' : 'UEBERLAPPT um '
        + Math.round(r.bottom - t.top) + 'px'));
  } else log('### Pausenleiste nicht sichtbar, Geometrie nicht messbar');`;

const DIALOGE = `
  var sheet = function(){ return !d.getElementById('sheet').classList.contains('hidden'); };
  var titel = function(){ return (d.getElementById('sheetTitle')||{}).textContent || ''; };
  var zahl = function(k){ return JSON.parse(localStorage.getItem('gym.v1'))[k].length; };
  function ok(b, s){ log((b ? 'OK   ' : 'FEHLT') + '  ' + s); }

  /* Native Dialoge tot stellen: so verhält sich die installierte App. */
  w.alert = w.confirm = w.prompt = function(){ return undefined; };
  log('--- 1. native Dialoge tot gestellt, Löschwege durchklicken');
  var vor = zahl('sessions');
  d.querySelector('[data-nav="verlauf"]').click(); await wait(300);
  var se = d.querySelector('#view-verlauf [data-act="session"]');
  ok(!!se, 'Verlauf: Einheit anklickbar');
  if (se) { se.click(); await wait(350);
    ok(sheet(), 'Sheet der Einheit offen ("' + titel() + '")');
    var del = d.getElementById('se_del');
    ok(!!del, 'Knopf "Training löschen" vorhanden');
    if (del) { del.click(); await wait(350);
      ok(sheet() && /löschen\\?/i.test(titel()), 'Rückfrage als Sheet, nicht als confirm()');
      var o = d.getElementById('dlgOk');
      ok(!!o, 'Rückfrage hat eigenen Knopf');
      if (o) { o.click(); await wait(400);
        ok(zahl('sessions') === vor - 1, 'Einheit wirklich gelöscht (' + vor + ' -> ' + zahl('sessions') + ')');
        ok(!sheet(), 'Sheet danach zu'); } } }
  d.querySelector('[data-nav="uebungen"]').click(); await wait(300);
  var ed = d.querySelector('#view-uebungen [data-act="editex"]');
  if (!ed) { var z = d.querySelector('#view-uebungen [data-act="ex"]');
    if (z) { z.click(); await wait(350); ed = d.querySelector('[data-act="editex"]'); } }
  ok(!!ed, 'Weg zu "Übung bearbeiten" gefunden');
  if (ed) { ed.click(); await wait(350);
    var du = d.getElementById('f_del');
    ok(!!du, 'Knopf "Übung löschen" vorhanden');
    ok(!!d.getElementById('f_arch'), 'daneben "Archivieren" (behält den Verlauf)');
    if (du) { du.click(); await wait(350);
      ok(sheet() && /löschen\\?/i.test(titel()), 'Rückfrage als Sheet');
      var o2 = d.getElementById('dlgOk'); if (o2) { o2.click(); await wait(400); } } }

  log('--- 2. Installieren-Knopf nachgestellt');
  d.querySelector('[data-nav="einst"]').click(); await wait(300);
  var btn = function(){ return d.getElementById('btnInstall'); };
  ok(btn() && btn().classList.contains('hidden'), 'vor dem Ereignis verborgen');
  var prompted = 0;
  var ev = new w.Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = function(){ prompted++; };
  ev.userChoice = Promise.resolve({ outcome: 'accepted' });
  w.dispatchEvent(ev); await wait(250);
  ok(btn() && !btn().classList.contains('hidden'), 'nach beforeinstallprompt sichtbar');
  ok(ev.defaultPrevented, 'preventDefault gerufen (keine eigene Chrome-Leiste)');
  if (btn()) { btn().click(); await wait(300);
    ok(prompted === 1, 'Antippen ruft prompt() genau einmal (prompted=' + prompted + ')');
    ok(btn().classList.contains('hidden'), 'Knopf danach wieder verborgen'); }
  w.dispatchEvent(new w.Event('appinstalled')); await wait(300);
  var t = d.getElementById('toast');
  ok(t && !t.classList.contains('hidden'), 'appinstalled zeigt Toast ("' + (t ? t.textContent.trim() : '') + '")');

  log('--- 3. Zurück-Taste: Sheet -> Tab -> Abschiedsdialog');
  await wait(900);
  d.querySelector('[data-nav="verlauf"]').click(); await wait(300);
  var s2 = d.querySelector('#view-verlauf [data-act="session"]');
  if (s2) { s2.click(); await wait(350); ok(sheet(), 'Sheet offen vor dem ersten Zurück'); }
  w.history.back(); await wait(450); ok(!sheet(), 'erstes Zurück schließt das Sheet');
  w.history.back(); await wait(450);
  var tit = (d.getElementById('viewTitle')||{}).textContent;
  ok(tit === 'Heute', 'zweites Zurück führt auf Heute (ist: "' + tit + '")');
  w.history.back(); await wait(450);
  ok(sheet() && /verlassen/i.test(titel()), 'drittes Zurück fragt nach dem Verlassen ("' + titel() + '")');`;

function seite(db, theme, koerper) {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>laeuft</title>
<style>body{margin:0;font:12px monospace}iframe{width:375px;height:700px;border:0;display:block}</style>
</head><body><pre id="out"></pre><iframe id="f"></iframe>
<script>
'use strict';
var DB = ${JSON.stringify(db)};
var THEME = ${JSON.stringify(theme)};
var LOG = [];
function log(s){ LOG.push(s); document.getElementById('out').textContent = LOG.join('\\n'); }
function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
${PRUEFER}
function pruefe(w, name){
  var of = overflow(w), kz = kleineZiele(w);
  log('### ' + name);
  log('  Überlauf: ' + (of.length ? JSON.stringify(of) : 'keiner'));
  log('  kleine Ziele: ' + (kz.length ? JSON.stringify(kz) : 'keine'));
}
localStorage.setItem('gym.v1', DB);
localStorage.setItem('gym.theme', THEME);
sessionStorage.clear();
var f = document.getElementById('f');
f.src = '../index.html';
f.onload = async function(){
  var w = f.contentWindow, d = w.document;
  await wait(600);
${koerper}
  log('FERTIG');
  document.title = 'FERTIG';
};
<\/script></body></html>`;
}

const tmp = path.join(__dirname, '.pruefen.html');   // muss gleicher Ursprung wie die App sein
let fehler = 0;
try {
  for (const theme of themes) {
    fs.writeFileSync(tmp, seite(datensatz(theme), theme, dialoge ? DIALOGE : LAYOUT));
    const dom = execFileSync('google-chrome', [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      '--disable-features=Translate', '--window-size=420,760', '--hide-scrollbars',
      '--virtual-time-budget=40000', '--dump-dom',
      `http://127.0.0.1:${PORT}/tools/${path.basename(tmp)}`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
    if (!m) { console.error(`\n### ${theme}: keine Ausgabe – läuft der Server auf Port ${PORT}?`); fehler++; continue; }
    const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    console.log(`\n═══ ${dialoge ? 'Dialoge, Installieren, Zurück' : 'Layout und Kontrast'} – Theme ${theme} ═══`);
    console.log(text);
    if (!/FERTIG\s*$/.test(text)) { console.error('### Lauf nicht durchgelaufen'); fehler++; }
    if (/FEHLT/.test(text)) fehler++;
  }
} finally {
  fs.rmSync(tmp, { force: true });
}
process.exit(fehler ? 1 : 0);
