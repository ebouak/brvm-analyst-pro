/**
 * Bulletin du marché (Stress Monitor) : TOUT texte qui dépend des données sort d'ici.
 * Pur, sans I/O, testé (bulletin.test.ts). Spec :
 * docs/superpowers/specs/2026-11-28-stress-bulletin-landing-design.md.
 *
 * Descriptif, jamais prédictif : on dit le niveau de tension MESURÉ, jamais ce qui va
 * suivre (banc d'évaluation 2007-2026 : `non_prouve`). Aucun conseil.
 */
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';
import { POIDS_NOMINAUX_STRESS, type CleComposanteStress, type RegimeStress, type StressDailyRow } from './stressIndexTypes';

const NBSP = '\u00a0';

export const VERDICTS: Record<RegimeStress, string> = {
  faible_tension: 'Le marché est calme',
  tension_moderee: 'Le marché est sous tension modérée',
  tension_elevee: 'Le marché est sous tension élevée',
  tension_extreme: 'Le marché est sous forte tension',
};

/** Réponse courte de la landing à « Le marché est-il nerveux ? ». */
export const REPONSES_THERMOMETRE: Record<RegimeStress, string> = {
  faible_tension: 'Non, plutôt calme.',
  tension_moderee: 'Un peu.',
  tension_elevee: 'Oui.',
  tension_extreme: 'Oui, très.',
};

export const NIVEAUX_COURTS: Record<RegimeStress, string> = {
  faible_tension: 'calme',
  tension_moderee: 'modérée',
  tension_elevee: 'élevée',
  tension_extreme: 'extrême',
};

/** Titres NEUTRES : le titre ne qualifie jamais, c'est la mesure qui dit le fait (vrai aussi en marché calme). */
const TITRES: Record<CleComposanteStress, string> = {
  drawdown_composite: 'Recul depuis le plus haut',
  largeur_baissiere: 'Titres en baisse',
  volatilite_brvmv: 'Agitation des cours',
  diffusion_sectorielle: 'Secteurs en baisse',
  pression_volumes: 'Échanges sur titres en baisse',
  momentum_court_terme: 'Tendance des dernières semaines',
};

/** Définitions simples, reprises par les bulles « ⓘ » de la partie détaillée. */
export const DEFINITIONS_COMPOSANTES: Record<CleComposanteStress, string> = {
  drawdown_composite: 'Écart entre le niveau du BRVM Composite et son plus haut. Plus il est grand, plus la tension monte.',
  largeur_baissiere: 'Part des titres cotés en baisse, en moyenne sur les cinq dernières séances.',
  volatilite_brvmv: 'Amplitude des variations quotidiennes du marché (volatilité réalisée sur vingt séances, indice BRVM-V).',
  diffusion_sectorielle: 'Part de la capitalisation boursière située dans des secteurs en baisse sur vingt séances.',
  pression_volumes: 'Part des volumes échangés sur des titres en baisse, sur cinq séances.',
  momentum_court_terme: 'Variation du BRVM Composite sur les vingt dernières séances.',
};

function mesure(cle: CleComposanteStress, v: number): string {
  switch (cle) {
    case 'drawdown_composite':
      return `${fmtNumber(Math.abs(v), 1)}${NBSP}% sous le plus haut`;
    case 'largeur_baissiere':
      return `${fmtNumber(Math.round(v / 10), 0)} titres sur 10 en baisse (5 séances)`;
    case 'volatilite_brvmv':
      return `Volatilité de ${fmtNumber(v, 1)}${NBSP}% (20 séances)`;
    case 'diffusion_sectorielle':
      return `${fmtNumber(v, 0)}${NBSP}% de la capitalisation dans des secteurs en baisse`;
    case 'pression_volumes':
      return `${fmtNumber(v, 0)}${NBSP}% des volumes sur des titres en baisse (5 séances)`;
    case 'momentum_court_terme':
      return `${fmtPctSigne(v, 1)} en 20 séances`;
  }
}

export interface PlusHautComposite {
  /** Recul du BRVM Composite depuis son plus haut, en % (négatif). Même source que `dateSommet`. */
  drawdownPct: number;
  dateSommet: string | null;
}

export interface CriseProche {
  libelle: string;
  ressemblance: number;
}

export interface EntreeBulletin {
  actuel: StressDailyRow;
  /** Ordre chronologique croissant. */
  historique: readonly StressDailyRow[];
  composite?: PlusHautComposite | null;
  criseProche?: CriseProche | null;
}

export interface Facteur {
  cle: CleComposanteStress;
  titre: string;
  mesure: string;
  score: number;
  poids: number;
  definition: string;
}

export interface Repere {
  date: string;
  valeur: number;
  libelle: string;
}

export interface Bulletin {
  regime: RegimeStress;
  verdict: string;
  reponse: string;
  niveau: string;
  note: number;
  phrases: string[];
  facteurs: Facteur[];
  passe: CriseProche | null;
}

export function regimeDe(indice: number): RegimeStress {
  if (indice >= 75) return 'tension_extreme';
  if (indice >= 50) return 'tension_elevee';
  if (indice >= 25) return 'tension_moderee';
  return 'faible_tension';
}

export function phraseTrajectoire(e: EntreeBulletin): string | null {
  const actuel = Math.round(e.actuel.stress_index);
  const date = e.composite?.dateSommet ?? null;
  if (date) {
    const jour = e.historique.find((r) => r.date_marche === date);
    if (jour && Number.isFinite(jour.stress_index)) {
      const depart = Math.round(jour.stress_index);
      if (depart !== actuel) return `Depuis le ${fmtDateCourte(date)}, la tension est passée de ${depart} à ${actuel}.`;
    }
  }
  const v = e.actuel.variation_20j_pts;
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) < 2) return 'En 20 séances, la tension est restée stable.';
  return `En 20 séances, la tension a ${v > 0 ? 'augmenté' : 'baissé'} de ${fmtNumber(Math.abs(v), 0)} points.`;
}

export function phraseAmpleur(actuel: StressDailyRow, composite?: PlusHautComposite | null): string | null {
  const dd = composite?.drawdownPct ?? actuel.observables_marche?.drawdown_brvmc_pct;
  if (dd == null || !Number.isFinite(dd)) return null;
  if (dd > -0.5) return 'Le BRVM Composite est à son plus haut.';
  const date = composite?.dateSommet ? ` du ${fmtDateCourte(composite.dateSommet)}` : '';
  return `Le BRVM Composite est ${fmtNumber(Math.abs(dd), 0)}${NBSP}% sous son plus haut${date}.`;
}

export function phraseEtendue(actuel: StressDailyRow): string | null {
  const v = actuel.composantes?.diffusion_sectorielle?.valeur_brute;
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 99.5) return 'La baisse touche tous les secteurs.';
  if (v >= 60) return 'La baisse touche la plupart des secteurs.';
  if (v >= 30) return 'Une partie des secteurs recule.';
  return 'Peu de secteurs reculent.';
}

/** Les trois composantes de plus forte contribution score × poids (indisponibles ignorées). */
export function choisirFacteurs(actuel: StressDailyRow, composite?: PlusHautComposite | null): Facteur[] {
  const cles = Object.keys(TITRES) as CleComposanteStress[];
  return cles
    .flatMap((cle) => {
      const c = actuel.composantes?.[cle];
      if (!c || c.score_0_100 == null || c.valeur_brute == null) return [];
      if (!Number.isFinite(c.score_0_100) || !Number.isFinite(c.valeur_brute)) return [];
      const poids = c.poids_effectif ?? c.poids_nominal;
      return [{ cle, score: c.score_0_100, brute: c.valeur_brute, poids, contribution: c.score_0_100 * poids }];
    })
    .sort((a, b) => b.contribution - a.contribution || POIDS_NOMINAUX_STRESS[b.cle] - POIDS_NOMINAUX_STRESS[a.cle])
    .slice(0, 3)
    .map(({ cle, score, brute, poids }) => ({
      cle,
      titre: TITRES[cle],
      // Le recul affiché suit la source officielle de la phrase d'ampleur quand elle est connue :
      // un même recul ne doit jamais montrer deux chiffres sur la même page (le 2026-11-27,
      // l'indice de tension avait été calculé sur une clôture provisoire : 18,63 % contre 18,39 %).
      mesure: mesure(cle, cle === 'drawdown_composite' && composite ? composite.drawdownPct : brute),
      score,
      poids,
      definition: DEFINITIONS_COMPOSANTES[cle],
    }));
}

/** Repères dessinés sur la fenêtre affichée (au plus trois, dates uniques). */
export function reperesFenetre(serie: readonly { date: string; valeur: number }[], dateSommet?: string | null): Repere[] {
  if (serie.length < 2) return [];
  const reperes: Repere[] = [];
  for (const seuil of [75, 50]) {
    let dernier: Repere | null = null;
    for (let i = 1; i < serie.length; i++) {
      if (serie[i - 1].valeur < seuil && serie[i].valeur >= seuil) {
        dernier = { date: serie[i].date, valeur: serie[i].valeur, libelle: `Seuil ${seuil} franchi` };
      }
    }
    if (dernier) {
      reperes.push(dernier);
      break;
    }
  }
  const bas = serie.reduce((m, p) => (p.valeur < m.valeur ? p : m), serie[0]);
  reperes.push({ date: bas.date, valeur: bas.valeur, libelle: 'Point le plus calme' });
  if (dateSommet) {
    const p = serie.find((x) => x.date === dateSommet);
    if (p) reperes.push({ date: p.date, valeur: p.valeur, libelle: 'Plus haut du Composite' });
  }
  const vues = new Set<string>();
  return reperes
    .filter((r) => {
      if (vues.has(r.date)) return false;
      vues.add(r.date);
      return true;
    })
    .slice(0, 3);
}

export function construireBulletin(e: EntreeBulletin): Bulletin {
  const regime = e.actuel.regime in VERDICTS ? e.actuel.regime : regimeDe(e.actuel.stress_index);
  return {
    regime,
    verdict: VERDICTS[regime],
    reponse: REPONSES_THERMOMETRE[regime],
    niveau: NIVEAUX_COURTS[regime],
    note: Math.round(e.actuel.stress_index),
    phrases: [phraseTrajectoire(e), phraseAmpleur(e.actuel, e.composite), phraseEtendue(e.actuel)].filter(
      (p): p is string => Boolean(p),
    ),
    facteurs: choisirFacteurs(e.actuel, e.composite),
    passe: e.criseProche ?? null,
  };
}
