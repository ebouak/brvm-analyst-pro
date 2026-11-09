import type { CleFamille, Tier } from './facteurs';

export type TypePhrase = 'convergence' | 'divergence' | 'info';
export interface PhraseCroisement { type: TypePhrase; texte: string }

export interface EntreesCroisement {
  tiers: Partial<Record<CleFamille, Tier | null>>;
  /** Libellé de la période intermédiaire (« T3 2026 »), null si aucune. */
  periode: string | null;
  variationResultatPct: number | null;
  variationCaPct: number | null;
  nbActualites: number;
}

const SEUIL = 10;

/** Valeur absolue au format français, une décimale au plus : « 31 % », « 12,5 % » (le sens est dans la phrase). */
function pct(x: number): string {
  const s = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(x)).replace(/[  ]/g, ' ');
  return `${s} %`;
}

/**
 * Convergences et divergences entre les facteurs et les derniers résultats
 * publiés. Rédaction PAR RÈGLES : chaque chiffre vient des entrées, aucune IA.
 */
export function croisement(e: EntreesCroisement): PhraseCroisement[] {
  const out: PhraseCroisement[] = [];
  const t = e.tiers;
  const p = e.periode;
  const res = e.variationResultatPct;
  const ca = e.variationCaPct;

  if (p == null || (res == null && ca == null)) {
    out.push({ type: 'info', texte: 'Pas de résultat intermédiaire comparable publié.' });
  } else {
    if (res != null && t.valorisation === 'haut' && res < -SEUIL)
      out.push({ type: 'divergence', texte: `Se paie peu cher, mais le résultat du ${p} recule de ${pct(res)} sur un an.` });
    if (res != null && t.valorisation === 'bas' && res > SEUIL)
      out.push({ type: 'divergence', texte: `Se paie cher, mais le résultat du ${p} progresse de ${pct(res)} sur un an.` });
    if (ca != null && t.tendance === 'haut' && ca > 0)
      out.push({ type: 'convergence', texte: `Tendance forte, confirmée par un chiffre d'affaires du ${p} en hausse de ${pct(ca)}.` });
    if (ca != null && t.tendance === 'haut' && ca < 0)
      out.push({ type: 'divergence', texte: `Tendance forte, alors que le chiffre d'affaires du ${p} baisse de ${pct(ca)}.` });
    if (res != null && t.tendance === 'bas' && res > SEUIL)
      out.push({ type: 'divergence', texte: `Tendance faible malgré un résultat du ${p} en hausse de ${pct(res)}.` });
    if (res != null && t.qualite === 'haut' && res < -SEUIL)
      out.push({ type: 'divergence', texte: `Rentabilité solide sur l'exercice, mais résultat du ${p} en recul de ${pct(res)}.` });
    if (out.length === 0)
      out.push({ type: 'info', texte: 'Les derniers résultats ne contredisent ni ne confirment nettement les facteurs.' });
  }

  if (e.nbActualites > 5)
    out.push({ type: 'info', texte: `Valeur très présente dans l'actualité (${e.nbActualites} articles en 30 jours).` });
  return out;
}
