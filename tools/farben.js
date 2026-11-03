#!/usr/bin/env node
'use strict';
/* Kategorie-Farben prüfen: Abstand benachbarter Farben bei normalem Sehen
   und bei Rot-Grün-Schwäche (Protanopie, Deuteranopie).

   Aufruf:  node tools/farben.js '#5EEAD4' '#E8C586' '#F8907F'
   Reihenfolge wie im Diagramm (z. B. im gestapelten Balken), für jedes
   Theme einzeln. Ziel: Nachbarn mindestens ΔE 15 normal und ΔE 8 bei
   Rot-Grün-Schwäche.

   ΔE nach CIEDE2000 in CIELAB (D65). Farbsehschwäche nach Machado et al.
   (2009), Schweregrad 1,0, angewendet auf lineares sRGB. */

const MIN_NORMAL = 15, MIN_CVD = 8;

const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};

function hexToLin(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Keine Farbe im Format #RRGGBB: ${hex}`);
  return [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

const simulate = (lin, M) => M.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])));

function linToLab([r, g, b]) {
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 (Sharma, Wu, Dalal 2005). */
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, ap) => { if (b === 0 && ap === 0) return 0; const t = Math.atan2(b, ap) * deg; return t < 0 ? t + 360 : t; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

function check(hexes) {
  const rows = [];
  for (let i = 0; i < hexes.length - 1; i++) {
    const a = hexToLin(hexes[i]), b = hexToLin(hexes[i + 1]);
    const normal = de2000(linToLab(a), linToLab(b));
    const protan = de2000(linToLab(simulate(a, CVD.protan)), linToLab(simulate(b, CVD.protan)));
    const deutan = de2000(linToLab(simulate(a, CVD.deutan)), linToLab(simulate(b, CVD.deutan)));
    const ok = normal >= MIN_NORMAL && protan >= MIN_CVD && deutan >= MIN_CVD;
    rows.push({ pair: `${hexes[i]} → ${hexes[i + 1]}`, normal, protan, deutan, ok });
  }
  return rows;
}

if (typeof module === 'object' && module.exports) module.exports = { de2000, linToLab, hexToLin, check };

if (require.main === module) {
  const hexes = process.argv.slice(2);
  if (hexes.length < 2) {
    console.log("Aufruf: node tools/farben.js '#RRGGBB' '#RRGGBB' … (Reihenfolge wie im Diagramm)");
    process.exit(1);
  }
  const f = (v) => v.toFixed(1).padStart(6);
  console.log(`Ziel: normal ≥ ${MIN_NORMAL}, Protan/Deutan ≥ ${MIN_CVD}\n`);
  console.log('Nachbarn'.padEnd(22) + 'normal  protan  deutan');
  let all = true;
  for (const r of check(hexes)) {
    all = all && r.ok;
    console.log(r.pair.padEnd(22) + f(r.normal) + '  ' + f(r.protan) + '  ' + f(r.deutan) + (r.ok ? '' : '   ZU NAH'));
  }
  console.log(all ? '\nAlle Nachbarn in Ordnung.' : '\nMindestens ein Paar ist zu nah: Farbe oder Reihenfolge ändern, dann neu prüfen.');
  process.exit(all ? 0 : 2);
}
