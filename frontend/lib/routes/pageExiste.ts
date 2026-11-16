import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Une URL interne statique (« /actions », « /formations/academy ») mène-t-elle à
 * une page de l'App Router ? Utilisé par les tests de contenu pour refuser un lien mort.
 *
 * Tient compte des GROUPES DE ROUTES : `app/actions/(liste)/page.tsx` sert
 * `/actions`. Les parenthèses n'apparaissent jamais dans l'URL ; un test qui
 * cherche seulement `app/actions/page.tsx` déclarerait la page absente.
 */
export function pageExiste(dossierApp: string, href: string): boolean {
  const segments = href.split(/[?#]/)[0]!.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return chercher(dossierApp, segments);
}

function chercher(dossier: string, segments: string[]): boolean {
  if (!existsSync(dossier)) return false;
  if (segments.length === 0 && existsSync(path.join(dossier, 'page.tsx'))) return true;
  const groupes = readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
    .map((e) => path.join(dossier, e.name));
  if (groupes.some((g) => chercher(g, segments))) return true;
  if (segments.length === 0) return false;
  const [tete, ...reste] = segments;
  return chercher(path.join(dossier, tete!), reste);
}
