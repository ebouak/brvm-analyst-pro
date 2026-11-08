import { PLAFOND_PENALITE_RISQUE } from './affichage';
import type { Decomposition } from './quant';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Notes de calcul du modèle (codes internes) vers le français. Un code inconnu reste tel quel. */
export function traduireNote(brut: string): string {
  const n = brut.trim();
  if (n === 'Bénéfice <=0: PER/EY neutralisés') return 'Bénéfice négatif ou nul : PER et rendement des bénéfices neutralisés';
  let m = n.match(/^EQ sur (\d+) facteurs$/);
  if (m) return `Qualité des bénéfices calculée sur ${m[1]} facteurs`;
  m = n.match(/^ValueScore sur (\d+)\/(\d+) facteurs$/);
  if (m) return `Valorisation calculée sur ${m[1]} facteurs sur ${m[2]}`;
  m = n.match(/^Seulement (\d+)\/(\d+) piliers disponibles$/);
  if (m) return `Seulement ${m[1]} piliers disponibles sur ${m[2]}`;
  m = n.match(/^Score sur (\d+)\/(\d+) facteurs \(poids redistribués\)$/);
  if (m) return `Score calculé sur ${m[1]} facteurs sur ${m[2]} (poids redistribués)`;
  m = n.match(/^Données insuffisantes \(<(\d+) facteurs momentum\)$/);
  if (m) return `Données insuffisantes (moins de ${m[1]} facteurs de momentum)`;
  m = n.match(/^Payout >(\d+)%: (.+)$/);
  if (m) return `Taux de distribution supérieur à ${m[1]} % : ${m[2]}`;
  m = n.match(/^(Coût du risque indisponible|Données prudentielles insuffisantes): (.+)$/);
  if (m) return `${m[1]} : ${m[2]}`;
  return brut;
}

/** Raison d'un garde-fou, en français. `dateCalcul` : date lisible du calcul (« 5 oct. 2026 »), facultative. */
export function traduireRaison(p: { code: string; reason: string }, dateCalcul: string | null): string {
  if (p.code === 'LIQ') {
    const m = p.reason.match(/^LiquidityScore (\S+) → -(\d+)$/);
    if (m) {
      return m[1] === 'N/A'
        ? `score de liquidité indisponible : −${m[2]}`
        : `score de liquidité ${m[1]}${dateCalcul ? ` (au ${dateCalcul})` : ''} : −${m[2]}`;
    }
  }
  if (p.code === 'VOL') {
    const m = p.reason.match(/^Vol ([\d.]+) rang (\d+)% → -(\d+)$/);
    if (m) return `volatilité ${nf(Number(m[1]), 2)}, plus forte que ${m[2]} % des valeurs : −${m[3]}`;
  }
  if (p.reason === 'penalite risque') return 'pénalité de risque';
  return p.reason;
}

export interface ChaineGardeFous {
  /** Points de chaque garde-fou, dans l'ordre reçu. */
  points: number[];
  /** Total brut des garde-fous déclenchés. */
  total: number;
  plafond: number;
  /** Pénalité de risque global (RISK), seule retirée de la somme pondérée. */
  risque: number;
  risquePlafonne: boolean;
  /** Liquidité et volatilité : déjà déduites du pilier Momentum. */
  dansMomentum: number;
  /** Pénalité effectivement mesurée : somme pondérée − score (arrondi du score compris). */
  appliquee: number | null;
}

/**
 * Chaîne de calcul des garde-fous. Règle lue dans lib/quant : LIQ et VOL sont déduits du score
 * Momentum ; RISK est retiré de la somme pondérée, plafonné à 25. `appliquee` vient de decomposerScore.
 */
/** Une phrase, identique sur la fiche et la page Quant : ce qui est retiré du score, ce qui l'est déjà du Momentum. */
export function resumeGardeFous(c: ChaineGardeFous | null): string | null {
  if (!c) return null;
  const morceaux: string[] = [];
  if (c.risque > 0) {
    const retire = Math.min(c.risque, c.plafond);
    morceaux.push(`Pénalité de risque −${retire} pts retirée du score (plafond ${c.plafond}${c.risquePlafonne ? ' atteint' : ''})`);
  }
  if (c.dansMomentum > 0) morceaux.push(`liquidité et volatilité (−${c.dansMomentum} pts) déjà déduites du pilier Momentum`);
  return morceaux.length ? morceaux.join(' · ') : null;
}

export function chaineGardeFous(penalites: { code: string; points: number }[], decomposition: Decomposition | null): ChaineGardeFous | null {
  if (penalites.length === 0) return null;
  const total = penalites.reduce((a, p) => a + p.points, 0);
  const risque = penalites.filter((p) => p.code === 'RISK').reduce((a, p) => a + p.points, 0);
  return {
    points: penalites.map((p) => p.points),
    total,
    plafond: PLAFOND_PENALITE_RISQUE,
    risque,
    risquePlafonne: risque > PLAFOND_PENALITE_RISQUE,
    dansMomentum: penalites.filter((p) => p.code === 'LIQ' || p.code === 'VOL').reduce((a, p) => a + p.points, 0),
    appliquee: decomposition ? decomposition.penalite : null,
  };
}
