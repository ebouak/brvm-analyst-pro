/**
 * Présentation des réactions de cours aux publications (lot 5, Événements et impact).
 * Fonctions PURES. Le calcul de la réaction elle-même vit dans `lib/reactionPublication.ts`
 * (contrat commun) : ce module ne fait que la mettre en forme et la résumer.
 */
import { fmtPctSigne } from '@/lib/format';

export interface ReactionBrute {
  ecartIndicePct: number | null;
  enCours: boolean;
}

export type AffichageReaction =
  | { genre: 'mesuree'; valeur: number; sens: 'hausse' | 'baisse' | 'neutre'; texte: string }
  | { genre: 'en_cours'; texte: 'en cours' }
  | { genre: 'indisponible'; texte: '—' };

/** « en cours » si la fenêtre n'est pas close ; « — » si non mesurable ; sinon l'écart signé à l'indice. */
export function affichageReaction(r: ReactionBrute | null | undefined): AffichageReaction {
  if (!r) return { genre: 'indisponible', texte: '—' };
  if (r.enCours) return { genre: 'en_cours', texte: 'en cours' };
  if (r.ecartIndicePct == null || !Number.isFinite(r.ecartIndicePct)) return { genre: 'indisponible', texte: '—' };
  const v = r.ecartIndicePct;
  const sens = v > 0 ? 'hausse' : v < 0 ? 'baisse' : 'neutre';
  return { genre: 'mesuree', valeur: v, sens, texte: fmtPctSigne(v, 2) };
}

/**
 * Médiane des seules réactions mesurées ET closes ; null sous 3 mesures
 * (même règle que `reactionsPublications` du contrat commun).
 */
export function medianeReactions(lignes: ReactionBrute[]): { mediane: number | null; nMesurees: number } {
  const v = lignes
    .filter((l) => !l.enCours && l.ecartIndicePct != null && Number.isFinite(l.ecartIndicePct))
    .map((l) => l.ecartIndicePct as number)
    .sort((a, b) => a - b);
  const n = v.length;
  if (n < 3) return { mediane: null, nMesurees: n };
  return { mediane: n % 2 === 1 ? v[(n - 1) / 2]! : (v[n / 2 - 1]! + v[n / 2]!) / 2, nMesurees: n };
}

/** Clé de la Map renvoyée par `chargerReactions`. */
export const cleReaction = (code: string, date: string) => `${code}|${date}`;

export type FiltrePeriode = '30j' | '90j' | '12m' | 'tout';
export const FILTRES_PERIODE: { id: FiltrePeriode; libelle: string }[] = [
  { id: '30j', libelle: '30 derniers jours' },
  { id: '90j', libelle: '90 derniers jours' },
  { id: '12m', libelle: '12 derniers mois' },
  { id: 'tout', libelle: 'Tout l’historique' },
];

export function lireFiltrePeriode(v: string | undefined): FiltrePeriode {
  return v === '30j' || v === '12m' || v === 'tout' ? v : '90j';
}

/** Date de début (AAAA-MM-JJ, incluse) d'un filtre de période, ou null pour « tout ». `ref` = AAAA-MM-JJ. */
export function debutPeriode(ref: string, p: FiltrePeriode): string | null {
  if (p === 'tout') return null;
  const t = Date.parse(`${ref}T12:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const jours = p === '30j' ? 30 : p === '90j' ? 90 : 365;
  return new Date(t - jours * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Titre-constat d'une fiche d'événement : DÉRIVÉ de la mesure, sans cause ni prévision.
 * Reste factuel : l'écart à l'indice sur la fenêtre, et rien d'autre.
 */
export function constatEvenement(p: {
  code: string;
  typeLibelle: string;
  periodeLibelle: string | null;
  ecartIndicePct: number | null;
  enCours: boolean;
  seancesObservees: number;
  horizon: number;
}): string {
  const objet = (p.periodeLibelle ? `${p.typeLibelle} (${p.periodeLibelle})` : p.typeLibelle).toLowerCase();
  const debut = `${p.code}, ${objet}`;
  if (p.enCours) {
    const n = p.seancesObservees;
    return n > 0
      ? `${debut} : fenêtre de mesure en cours, ${n} séance${n > 1 ? 's' : ''} sur ${p.horizon} observée${n > 1 ? 's' : ''}.`
      : `${debut} : aucune séance cotée observée depuis la publication.`;
  }
  if (p.ecartIndicePct == null) return `${debut} : écart à l’indice non mesurable (séries de cours incomplètes).`;
  const v = p.ecartIndicePct;
  const position = v > 0 ? 'au-dessus de' : v < 0 ? 'en dessous de' : 'au niveau de';
  return `${debut} : sur les ${p.horizon} séances suivant la publication, le cours a évolué ${position} l’indice BRVM Composite (${fmtPctSigne(v, 2)}).`;
}
