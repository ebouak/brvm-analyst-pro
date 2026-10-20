/**
 * Simulations pédagogiques des leçons Academy — fonctions PURES et testées
 * (simulations.test.ts).
 *
 * Ce sont des CALCULS sur des hypothèses écrites dans le contenu de la leçon,
 * jamais des données de marché : l'interface les étiquette « Simulation
 * pédagogique » et affiche les hypothèses sous le graphique.
 */

export interface ParamsReinvestissement {
  /** Actions détenues au départ. */
  actions: number;
  /** Dividende par action de la première année (FCFA, brut). */
  dpa: number;
  /** Cours de l'action la première année (FCFA). */
  cours: number;
  /** Progression annuelle du dividende ET du cours (%) : rendement constant. */
  croissance_pct: number;
  annees: number;
}

export interface LigneReinvestissement {
  annee: number;
  dpa: number;
  cours: number;
  /** Stratégie « dividendes conservés en espèces » : actions constantes. */
  revenuEspeces: number;
  cumulEspeces: number;
  /** Stratégie « dividendes réinvestis » : actions détenues pendant l'année. */
  actionsReinvest: number;
  revenuReinvest: number;
  cumulReinvest: number;
  /** Actions entières achetées en fin d'année avec le dividende (et le reliquat). */
  actionsAchetees: number;
  /** Espèces non réinvesties, reportées à l'année suivante. */
  reliquat: number;
}

const arrondi2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Hypothèses : dividende et cours progressent de `croissance_pct` par an ; les
 * dividendes de l'année t sont réinvestis au cours de l'année t, en actions
 * entières, le reliquat reste en espèces ; montants bruts, sans frais ni impôt.
 */
export function simulerReinvestissement(p: ParamsReinvestissement): LigneReinvestissement[] {
  if (!(p.actions > 0) || !(p.dpa > 0) || !(p.cours > 0) || !(p.annees >= 1) || !(p.croissance_pct > -100)) {
    throw new Error('simulation de réinvestissement : paramètres impossibles');
  }
  const g = 1 + p.croissance_pct / 100;
  const lignes: LigneReinvestissement[] = [];
  let actions = p.actions;
  let reliquat = 0;
  let cumulEspeces = 0;
  let cumulReinvest = 0;
  for (let t = 1; t <= p.annees; t++) {
    const dpa = arrondi2(p.dpa * g ** (t - 1));
    const cours = arrondi2(p.cours * g ** (t - 1));
    const revenuEspeces = Math.round(p.actions * dpa);
    const revenuReinvest = Math.round(actions * dpa);
    cumulEspeces += revenuEspeces;
    cumulReinvest += revenuReinvest;
    const disponible = reliquat + revenuReinvest;
    const actionsAchetees = Math.floor(disponible / cours);
    const detenues = actions;
    reliquat = arrondi2(disponible - actionsAchetees * cours);
    actions += actionsAchetees;
    lignes.push({
      annee: t,
      dpa,
      cours,
      revenuEspeces,
      cumulEspeces,
      actionsReinvest: detenues,
      revenuReinvest,
      cumulReinvest,
      actionsAchetees,
      reliquat,
    });
  }
  return lignes;
}

/** Capital nécessaire pour un revenu annuel visé, à chaque rendement HYPOTHÉTIQUE. */
export function capitalPourObjectif(
  revenuCible: number,
  rendementsPct: number[],
): { rendementPct: number; capital: number }[] {
  if (!(revenuCible > 0)) throw new Error('objectif de revenus : montant impossible');
  return rendementsPct.map((r) => {
    if (!(r > 0)) throw new Error(`objectif de revenus : rendement ${r} % impossible`);
    return { rendementPct: r, capital: Math.round(revenuCible / (r / 100)) };
  });
}
