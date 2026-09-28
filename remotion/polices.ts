import { continueRender, delayRender } from 'remotion';

/**
 * Polices du site (Bespoke Serif, Supreme, JetBrains Mono), attendues avant
 * la première image. Même identifiant que le chargeur de showreel.tsx : si
 * les deux modules sont chargés, les polices ne le sont qu'une fois.
 */
export const SERIF = '"Bespoke Serif", Georgia, serif';
export const SANS = '"Supreme", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"JetBrains Mono", Consolas, monospace';

if (typeof document !== 'undefined' && !document.getElementById('wb-polices')) {
  const attente = delayRender('Chargement des polices');
  const lien = document.createElement('link');
  lien.id = 'wb-polices';
  lien.rel = 'stylesheet';
  lien.href = 'https://api.fontshare.com/v2/css?f[]=supreme@400,500,700,800&f[]=bespoke-serif@400,500,700&display=block';
  const mono = document.createElement('link');
  mono.rel = 'stylesheet';
  mono.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=block';
  let restant = 2;
  const fini = () => {
    restant -= 1;
    if (restant > 0) return;
    Promise.all([
      document.fonts.load('600 60px "Bespoke Serif"'),
      document.fonts.load('500 20px "Supreme"'),
      document.fonts.load('700 20px "Supreme"'),
      document.fonts.load('500 20px "JetBrains Mono"'),
    ]).finally(() => continueRender(attente));
  };
  lien.onload = fini; lien.onerror = fini;
  mono.onload = fini; mono.onerror = fini;
  document.head.append(lien, mono);
}
