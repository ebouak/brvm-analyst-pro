/**
 * Comparaison d'une valeur aux MÉDIANES de ses pairs — module pur.
 *
 * Les métriques viennent de `quant_model_scores.raw_metrics_json` (dernier
 * calcul Combined Alpha) : elles sont déjà calculées pour toute la cote, sur
 * les mêmes définitions, et c'est ce que la page /actions/[code]/quant affiche.
 * Les recalculer ici aurait créé une seconde définition de « ROE » à tenir
 * juste.
 *
 * ⚠️ UNITÉS HÉTÉROGÈNES dans ce JSON (constaté le 2026-10-05) : ROE, ROA,
 * rendement et croissance sont des FRACTIONS (0,20) ; payout et couverture des
 * créances douteuses sont déjà en POURCENTS (80, 82). Chaque ligne porte son
 * facteur de conversion — un facteur oublié affiche un ROE de 0,2 %.
 *
 * Les groupes de pairs suivent la FAMILLE COMPTABLE avant le secteur : un
 * EV/EBITDA de banque (27,9× chez SGBC) n'a aucun sens, et comparer une banque
 * à la médiane d'un secteur « Services financiers » qui mêle d'autres métiers
 * fabriquerait un écart fictif.
 */

export type FamilleComparaison = 'banque' | 'assurance' | 'general';

interface DefinitionRatio {
  cle: string;
  libelle: string;
  /** Multiplicateur vers l'unité affichée. */
  facteur: number;
  unite: '%' | 'x';
  /** Sens favorable, pour qualifier l'écart sans jugement de valeur caché. */
  sens: 'haut' | 'bas' | 'neutre';
  /**
   * Multiple de valorisation : une valeur ≤ 0 (société en perte) n'est pas
   * « bon marché », elle est hors échelle. Écartée, sinon un PER négatif se
   * lirait « sous la médiane, donc favorable ».
   */
  multiple?: true;
}

const RATIOS: Record<FamilleComparaison, DefinitionRatio[]> = {
  general: [
    { cle: 'per', libelle: 'PER', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'pb', libelle: 'Cours / valeur comptable', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'evEbitda', libelle: 'VE / EBITDA', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'roe', libelle: 'ROE', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'roa', libelle: 'ROA', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'dividendYield', libelle: 'Rendement du dividende', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'payoutRatio', libelle: 'Taux de distribution', facteur: 1, unite: '%', sens: 'neutre' },
    { cle: 'netDebtToEbitda', libelle: 'Dette nette / EBITDA', facteur: 1, unite: 'x', sens: 'bas' },
    { cle: 'debtToEquity', libelle: 'Dette / capitaux propres', facteur: 1, unite: 'x', sens: 'bas' },
    { cle: 'interestCoverage', libelle: 'Couverture des intérêts', facteur: 1, unite: 'x', sens: 'haut' },
    { cle: 'currentRatio', libelle: 'Liquidité générale', facteur: 1, unite: 'x', sens: 'haut' },
    { cle: 'cashConversion', libelle: 'Conversion du résultat en cash', facteur: 1, unite: 'x', sens: 'haut' },
    { cle: 'epsGrowth3y', libelle: 'Croissance du BPA (3 ans)', facteur: 100, unite: '%', sens: 'haut' },
  ],
  banque: [
    { cle: 'per', libelle: 'PER', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'pb', libelle: 'Cours / valeur comptable', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'roe', libelle: 'ROE', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'roa', libelle: 'ROA', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'dividendYield', libelle: 'Rendement du dividende', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'payoutRatio', libelle: 'Taux de distribution', facteur: 1, unite: '%', sens: 'neutre' },
    { cle: 'nplCoverage', libelle: 'Couverture des créances non performantes (taux publié)', facteur: 1, unite: '%', sens: 'haut' },
    { cle: 'depositGrowth', libelle: 'Croissance des dépôts', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'epsGrowth3y', libelle: 'Croissance du BPA (3 ans)', facteur: 100, unite: '%', sens: 'haut' },
  ],
  assurance: [
    { cle: 'per', libelle: 'PER', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'pb', libelle: 'Cours / valeur comptable', facteur: 1, unite: 'x', sens: 'bas', multiple: true },
    { cle: 'roe', libelle: 'ROE', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'dividendYield', libelle: 'Rendement du dividende', facteur: 100, unite: '%', sens: 'haut' },
    { cle: 'combinedRatio', libelle: 'Ratio combiné', facteur: 1, unite: '%', sens: 'bas' },
  ],
};

/** Sous ce nombre de pairs renseignés, une médiane ne décrit plus un groupe. */
export const MIN_PAIRS = 3;
/** Un groupe sectoriel plus petit retombe sur la famille entière. */
const MIN_GROUPE_SECTEUR = 4;

export interface Pair {
  code: string;
  famille: FamilleComparaison;
  secteur: string | null;
  metriques: Record<string, unknown>;
}

export interface LigneComparaison {
  libelle: string;
  unite: '%' | 'x';
  valeur: number | null;
  mediane: number | null;
  nbPairs: number;
  /** 'au-dessus' / 'en-dessous' / 'proche' (±10 %), ou null si incomparable. */
  position: 'au-dessus' | 'en-dessous' | 'proche' | null;
  /** Lecture du sens : favorable / défavorable / neutre. */
  lecture: 'favorable' | 'defavorable' | 'neutre' | null;
}

export interface ComparaisonMedianes {
  groupe: string;
  nbSocietes: number;
  lignes: LigneComparaison[];
}

export function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const nombre = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;

function positionner(
  valeur: number | null,
  med: number | null,
  sens: DefinitionRatio['sens'],
): Pick<LigneComparaison, 'position' | 'lecture'> {
  if (valeur == null || med == null) return { position: null, lecture: null };
  const tolerance = Math.max(Math.abs(med) * 0.1, 1e-9);
  if (Math.abs(valeur - med) <= tolerance) return { position: 'proche', lecture: 'neutre' };
  const position = valeur > med ? 'au-dessus' : 'en-dessous';
  if (sens === 'neutre') return { position, lecture: 'neutre' };
  const favorable = (position === 'au-dessus') === (sens === 'haut');
  return { position, lecture: favorable ? 'favorable' : 'defavorable' };
}

/**
 * Compare `code` à ses pairs. Le groupe : même famille ET même secteur s'il
 * compte assez de sociétés, sinon toute la famille. La société elle-même est
 * EXCLUE du calcul de la médiane — sinon elle tire la référence vers elle.
 */
export function comparerAuxMedianes(code: string, univers: Pair[]): ComparaisonMedianes | null {
  const cible = univers.find((p) => p.code === code);
  if (!cible) return null;

  const famille = univers.filter((p) => p.famille === cible.famille && p.code !== code);
  const secteur = cible.secteur
    ? famille.filter((p) => p.secteur === cible.secteur)
    : [];
  const parSecteur = cible.famille === 'general' && secteur.length + 1 >= MIN_GROUPE_SECTEUR;
  const pairs = parSecteur ? secteur : famille;
  const groupe = parSecteur
    ? `secteur « ${cible.secteur} » (hors banques et assurances)`
    : cible.famille === 'banque'
      ? 'banques cotées à la BRVM'
      : cible.famille === 'assurance'
        ? 'assureurs cotés à la BRVM'
        : 'sociétés non financières cotées à la BRVM';

  const lignes = RATIOS[cible.famille].map((d): LigneComparaison => {
    const lire = (m: Record<string, unknown>) => {
      const v = nombre(m[d.cle]);
      return v != null && d.multiple && v <= 0 ? null : v;
    };
    const brut = lire(cible.metriques);
    const valeurs = pairs
      .map((p) => lire(p.metriques))
      .filter((v): v is number => v != null)
      .map((v) => v * d.facteur);
    const med = valeurs.length >= MIN_PAIRS ? mediane(valeurs) : null;
    const valeur = brut == null ? null : brut * d.facteur;
    return {
      libelle: d.libelle,
      unite: d.unite,
      valeur,
      mediane: med,
      nbPairs: valeurs.length,
      ...positionner(valeur, med, d.sens),
    };
  });

  return { groupe, nbSocietes: pairs.length, lignes };
}
