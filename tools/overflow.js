/* Seitliches Scrollen finden. In der Browser-Konsole ausführen, jede Ansicht
   in 375 px Breite. overflow-x:hidden am body verdeckt das Problem nur, dieser
   Schnipsel findet die Ursache. Leer heißt: in Ordnung. Sonst ist der erste
   Treffer fast immer eine Rasterzelle ohne min-width:0 oder ein Text ohne
   white-space/text-overflow. Container, die absichtlich in sich scrollen,
   in SCROLLT_SELBST eintragen. */
(() => {
  const SCROLLT_SELBST = '.chips';
  return [...document.querySelectorAll('body *')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; })
    .filter((e) => !e.closest(SCROLLT_SELBST))
    .slice(0, 10)
    .map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
})();
