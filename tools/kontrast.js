/* Kontrast der Text-Tokens auf --surface. In der Browser-Konsole ausführen,
   in beiden Themes (Theme über localStorage setzen, neu laden). Jeder Wert
   muss mindestens 4,5 sein. */
(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const tok = (n) => {
    const d = document.createElement('div');
    d.style.color = `var(${n})`;
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(tok(a)), lum(tok(b))].sort((p, q) => q - p);
    return +((x + 0.05) / (y + 0.05)).toFixed(2);
  };
  const out = {};
  ['--text', '--text-2', '--muted', '--accent', '--st-low', '--st-mid', '--st-high']
    .forEach((t) => { out[t] = ratio(t, '--surface'); });
  console.table(out);
  return out;
})();
