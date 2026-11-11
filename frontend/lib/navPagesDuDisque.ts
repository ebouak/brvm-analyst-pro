import fs from 'node:fs';
import path from 'node:path';

/**
 * RÉSERVÉ AUX TESTS (lit le disque). Le registre est la source unique de la navigation : chaque page de `app/`
 * (hors console /admin) doit y être déclarée, et rien d'autre.
 */
const APP = path.resolve(__dirname, '..', 'app');

export function pagesDuDisque(): string[] {
  const out: string[] = [];
  const parcourir = (dir: string, segs: string[]) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        // Groupes de routes « (x) » : invisibles dans l'adresse. Dossiers privés « _x » : pas des routes.
        if (e.name.startsWith('_')) continue;
        const suite = e.name.startsWith('(') && e.name.endsWith(')') ? segs : [...segs, e.name];
        parcourir(path.join(dir, e.name), suite);
      } else if (e.name === 'page.tsx' || e.name === 'page.ts' || e.name === 'page.jsx' || e.name === 'page.js') {
        out.push('/' + segs.join('/'));
      }
    }
  };
  parcourir(APP, []);
  return out.filter((c) => c !== '/admin' && !c.startsWith('/admin/')).sort();
}

