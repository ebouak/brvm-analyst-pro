/**
 * Scénario d'investissement partagé entre les modules du comparateur, porté
 * par l'URL : partageable, sans stockage, sans aucune donnée personnelle.
 * Toute valeur hors bornes ou illisible est ignorée (repli sur le défaut).
 */
export interface Scenario {
  montant: number;
  dureeAns: number;
  nbAchats: number;
  nbVentes: number;
  /** null : calcul automatique (montant ÷ nombre d'achats). */
  montantParOrdre: number | null;
}

export const SCENARIO_DEFAUT: Scenario = { montant: 1_000_000, dureeAns: 1, nbAchats: 4, nbVentes: 4, montantParOrdre: null };

export const DUREES_ANS = [0.25, 0.5, 1, 2, 3, 5] as const;
export const MONTANT_MIN = 50_000;
export const MONTANT_MAX = 100_000_000;
export const ORDRES_MAX = 12;

function entier(v: string | null, min: number, max: number): number | null {
  if (v == null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

export function lireScenario(params: URLSearchParams): Scenario {
  const duree = params.get('duree');
  const dureeAns = duree != null && (DUREES_ANS as readonly number[]).includes(Number(duree)) ? Number(duree) : null;
  return {
    montant: entier(params.get('capital'), MONTANT_MIN, MONTANT_MAX) ?? SCENARIO_DEFAUT.montant,
    dureeAns: dureeAns ?? SCENARIO_DEFAUT.dureeAns,
    nbAchats: entier(params.get('achats'), 0, ORDRES_MAX) ?? SCENARIO_DEFAUT.nbAchats,
    nbVentes: entier(params.get('ventes'), 0, ORDRES_MAX) ?? SCENARIO_DEFAUT.nbVentes,
    montantParOrdre: entier(params.get('ordre'), 1_000, MONTANT_MAX),
  };
}

/** Paramètres d'URL du scénario ; les valeurs par défaut sont omises. */
export function ecrireScenario(s: Scenario): URLSearchParams {
  const p = new URLSearchParams();
  if (s.montant !== SCENARIO_DEFAUT.montant) p.set('capital', String(Math.round(s.montant)));
  if (s.dureeAns !== SCENARIO_DEFAUT.dureeAns) p.set('duree', String(s.dureeAns));
  if (s.nbAchats !== SCENARIO_DEFAUT.nbAchats) p.set('achats', String(s.nbAchats));
  if (s.nbVentes !== SCENARIO_DEFAUT.nbVentes) p.set('ventes', String(s.nbVentes));
  if (s.montantParOrdre != null) p.set('ordre', String(Math.round(s.montantParOrdre)));
  return p;
}

/** Lien vers un module en gardant le scénario (et d'éventuels paramètres en plus). */
export function lienAvecScenario(chemin: string, s: Scenario, extra?: Record<string, string>): string {
  const p = ecrireScenario(s);
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
  const q = p.toString();
  return q ? `${chemin}?${q}` : chemin;
}
