/* In der Browser-Konsole ausführen, nacheinander.

   1. Native Dialoge tot stellen: verhält sich wie die installierte App, in der
      alert/confirm/prompt still unterdrückt werden können. Danach alle Wege
      durchklicken (Löschen, Import, Verlassen): nichts darf ins Leere laufen. */
window.alert = window.confirm = window.prompt = () => undefined;

/* 2. Installieren-Knopf nachstellen. Vorher: In den Einstellungen ist kein
      Installieren-Knopf zu sehen. Nach dem Ereignis schon; Antippen ruft
      prompt() auf (prompted wird 1) und blendet ihn aus. */
let prompted = 0;
const ev = new Event('beforeinstallprompt', { cancelable: true });
ev.prompt = () => { prompted++; };
ev.userChoice = Promise.resolve({ outcome: 'accepted' });
window.dispatchEvent(ev);

/* 3. Nach dem Antippen: Installation melden, der Toast muss erscheinen.
      window.dispatchEvent(new Event('appinstalled'));
   Ob Chrome das echte Ereignis schickt, zeigt sich erst auf dem Handy. */
