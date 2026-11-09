/**
 * Encodage et lecture des événements du flux SSE (module PUR, client et serveur).
 * Une ligne `data: {json}` par événement, séparées par une ligne vide.
 */
import type { EvenementFlux } from './types';

export function encoderEvenement(e: EvenementFlux): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

function estEvenement(x: unknown): x is EvenementFlux {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  switch (e.type) {
    case 'etape':
      return typeof e.libelle === 'string';
    case 'texte':
      return typeof e.texte === 'string';
    case 'erreur':
      return typeof e.message === 'string' && typeof e.code === 'string';
    case 'meta': {
      const m = e.meta as Record<string, unknown> | undefined;
      return (
        !!m &&
        (m.provenance === 'jev' || m.provenance === 'ia') &&
        Array.isArray(m.sources) &&
        m.sources.every((s) => s && typeof (s as { libelle?: unknown }).libelle === 'string') &&
        Array.isArray(m.relances) &&
        m.relances.every((r) => typeof r === 'string')
      );
    }
    default:
      return false;
  }
}

/** Lit les événements complets du tampon ; `reste` est la fin incomplète à reprendre au prochain morceau. */
export function lireEvenements(tampon: string): { evenements: EvenementFlux[]; reste: string } {
  const blocs = tampon.replace(/\r\n/g, '\n').split('\n\n');
  const reste = blocs.pop() ?? '';
  const evenements: EvenementFlux[] = [];
  for (const b of blocs) {
    const donnees = b
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!donnees) continue;
    try {
      const e = JSON.parse(donnees);
      if (estEvenement(e)) evenements.push(e);
    } catch {
      /* bloc illisible : ignoré, jamais affiché */
    }
  }
  return { evenements, reste };
}

/** Découpe une réponse vérifiée en morceaux de quelques mots, pour un affichage progressif. */
export function decouperTexte(texte: string, mots = 6): string[] {
  const jetons = texte.split(/(\s+)/);
  const sortie: string[] = [];
  let courant = '';
  let n = 0;
  for (const j of jetons) {
    courant += j;
    if (j.trim()) n += 1;
    if (n >= mots && /\s/.test(j) === false) {
      sortie.push(courant);
      courant = '';
      n = 0;
    }
  }
  if (courant) sortie.push(courant);
  return sortie;
}
