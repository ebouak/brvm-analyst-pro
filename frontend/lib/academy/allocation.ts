/**
 * Répartition par secteur et scénarios de baisse (leçon 6) : calculs PURS
 * testés (allocation.test.ts). Hypothèses écrites dans le contenu de la leçon,
 * jamais des données de marché.
 */

export interface LigneAllocation {
  nom: string;
  /** Part du capital, en %. */
  pct: number;
}

export type TypeAlerteAllocation = 'secteur_concentre' | 'total_inferieur' | 'total_superieur';

export interface AlerteAllocation {
  type: TypeAlerteAllocation;
  message: string;
}

export interface AnalyseAllocation {
  lignes: (LigneAllocation & { montant: number })[];
  totalPct: number;
  /** 100 − total : positif = reste à répartir, négatif = dépassement. */
  resteAReparti: number;
  alertes: AlerteAllocation[];
}

/** Repère PÉDAGOGIQUE de la leçon (pas une règle de marché). */
export const SEUIL_SECTEUR_PCT = 35;

const fmtPct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} %`;

/** Montants par secteur et alertes pédagogiques dérivées de la répartition. */
export function analyserAllocation(
  lignes: LigneAllocation[],
  capital: number,
  seuilSecteurPct: number = SEUIL_SECTEUR_PCT,
): AnalyseAllocation {
  if (!(capital > 0)) throw new Error('allocation : capital impossible');
  if (lignes.length === 0) throw new Error('allocation : aucune ligne');
  for (const l of lignes) {
    if (!Number.isFinite(l.pct) || l.pct < 0 || l.pct > 100) throw new Error(`allocation : part impossible pour ${l.nom}`);
  }
  const totalPct = Math.round(lignes.reduce((s, l) => s + l.pct, 0) * 100) / 100;
  const alertes: AlerteAllocation[] = [];
  for (const l of lignes) {
    if (l.pct > seuilSecteurPct) {
      alertes.push({
        type: 'secteur_concentre',
        message: `${l.nom} pèse ${fmtPct(l.pct)} : au-dessus du repère pédagogique de ${fmtPct(seuilSecteurPct)} par secteur. Une mauvaise nouvelle sur ce secteur toucherait une grande part du capital.`,
      });
    }
  }
  if (totalPct < 100) {
    alertes.push({ type: 'total_inferieur', message: `Le total fait ${fmtPct(totalPct)} : il reste ${fmtPct(100 - totalPct)} du capital à répartir.` });
  } else if (totalPct > 100) {
    alertes.push({ type: 'total_superieur', message: `Le total fait ${fmtPct(totalPct)} : vous dépassez le capital de ${fmtPct(totalPct - 100)}.` });
  }
  return {
    lignes: lignes.map((l) => ({ ...l, montant: Math.round((capital * l.pct) / 100) })),
    totalPct,
    resteAReparti: Math.round((100 - totalPct) * 100) / 100,
    alertes,
  };
}

export type ScenarioBaisse =
  | { type: 'marche'; baisse_pct: number }
  | { type: 'secteur'; nom: string; baisse_pct: number }
  | { type: 'dividende'; nom: string; facteur: number };

export interface ParamsScenario {
  capital: number;
  /** Rendement d'HYPOTHÈSE (%), identique pour toutes les lignes. */
  rendement_pct: number;
  lignes: LigneAllocation[];
}

export interface ResultatScenario {
  capitalAvant: number;
  capitalApres: number;
  revenuAvant: number;
  revenuApres: number;
  variationCapitalPct: number;
  variationRevenuPct: number;
  /** Ce que le scénario suppose, dit à l'écran. */
  hypotheses: string[];
}

const variation = (avant: number, apres: number) => (avant === 0 ? 0 : Math.round(((apres - avant) / avant) * 1000) / 10);

/**
 * Capital et revenu avant / après un scénario de baisse. Hypothèses (écrites
 * dans le résultat) : le revenu annuel de chaque ligne vaut sa part du capital
 * × le rendement d'hypothèse ; une baisse de COURS laisse le dividende par
 * action inchangé ; un dividende divisé ne change pas le cours. Aucun chiffre
 * de marché réel.
 */
export function simulerScenario(p: ParamsScenario, s: ScenarioBaisse): ResultatScenario {
  const a = analyserAllocation(p.lignes, p.capital);
  if (Math.abs(a.totalPct - 100) > 0.01) throw new Error('scénario : la répartition doit totaliser 100 %');
  if (!(p.rendement_pct >= 0)) throw new Error('scénario : rendement impossible');
  if (s.type !== 'marche' && !a.lignes.some((l) => l.nom === s.nom)) throw new Error(`scénario : ligne inconnue ${s.nom}`);
  if (s.type !== 'dividende' && !(s.baisse_pct >= 0 && s.baisse_pct <= 100)) throw new Error('scénario : baisse impossible');
  if (s.type === 'dividende' && !(s.facteur >= 0 && s.facteur <= 1)) throw new Error('scénario : facteur impossible');
  const r = p.rendement_pct / 100;

  let capitalApres = 0;
  let revenuApres = 0;
  for (const l of a.lignes) {
    let cap = l.montant;
    let rev = l.montant * r;
    if (s.type === 'marche') cap *= 1 - s.baisse_pct / 100;
    else if (s.type === 'secteur' && l.nom === s.nom) cap *= 1 - s.baisse_pct / 100;
    else if (s.type === 'dividende' && l.nom === s.nom) rev *= s.facteur;
    capitalApres += cap;
    revenuApres += rev;
  }

  const hypotheses: string[] = [];
  if (s.type === 'marche') hypotheses.push(`Tous les cours baissent de ${fmtPct(s.baisse_pct)} ; les dividendes par action restent inchangés.`);
  if (s.type === 'secteur') hypotheses.push(`Seuls les cours de « ${s.nom} » baissent de ${fmtPct(s.baisse_pct)} ; les dividendes par action restent inchangés.`);
  if (s.type === 'dividende') hypotheses.push(`Le dividende de « ${s.nom} » est multiplié par ${s.facteur} ; son cours ne bouge pas.`);
  hypotheses.push(`Revenu avant = capital × ${fmtPct(p.rendement_pct)} (rendement d’hypothèse, identique pour toutes les lignes).`);

  const capitalAvant = Math.round(p.capital);
  const revenuAvant = Math.round(p.capital * r);
  capitalApres = Math.round(capitalApres);
  revenuApres = Math.round(revenuApres);
  return {
    capitalAvant,
    capitalApres,
    revenuAvant,
    revenuApres,
    variationCapitalPct: variation(capitalAvant, capitalApres),
    variationRevenuPct: variation(revenuAvant, revenuApres),
    hypotheses,
  };
}
