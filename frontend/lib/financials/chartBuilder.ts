/**
 * Constructeur de graphique fondamental — logique PURE.
 *
 * L'utilisateur compose son graphique en cochant des séries (montants, ratios,
 * par-action) sur l'historique pluriannuel. L'« intelligence » est double et
 * entièrement déterministe :
 *
 * 1. Ratios dérivés calculés d'après les états (marges, ROE, croissance…) —
 *    jamais saisis, jamais estimés : si un terme manque, le point est null.
 * 2. Affectation automatique des axes par CLASSE D'UNITÉ. Trois classes
 *    incompatibles entre elles : 'fcfa' (montants, en Md), 'fcfa_action'
 *    (BPA/dividende, en centaines de FCFA), 'pct'. Les mélanger sur un même axe
 *    rendrait le graphique illisible (une barre de 300 Md écrase un BPA de 200).
 *    Règle : 2 classes maximum simultanément — la première sélectionnée prend
 *    l'axe gauche, la deuxième l'axe droit, une troisième est refusée.
 */
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from './types';

export type UnitClass = 'fcfa' | 'fcfa_action' | 'pct';

// L'intersection { periode: string } & Record<string, number | null> est
// insatisfiable en TS strict (l'index signature exigerait periode: number) :
// on liste donc explicitement les clés numériques du catalogue.
export interface ChartRow {
  periode: string;
  revenu: number | null;
  rex: number | null;
  rn: number | null;
  totalActif: number | null;
  capitauxPropres: number | null;
  dettesFin: number | null;
  fluxExploitation: number | null;
  fluxInvestissement: number | null;
  fluxFinancement: number | null;
  bpa: number | null;
  dividende: number | null;
  margeNette: number | null;
  margeRex: number | null;
  roe: number | null;
  croissanceCa: number | null;
}

/** Clé de série valide du catalogue (tout sauf `periode`). */
export type SerieId = Exclude<keyof ChartRow, 'periode'>;

export interface SerieDef {
  /** Typé `SerieId` : le catalogue ne peut référencer qu'une clé réellement
   *  produite par `buildChartRows` — un id fantaisiste ne compile pas. */
  id: SerieId;
  label: string;
  unit: UnitClass;
  /** Groupe d'affichage dans le sélecteur. */
  groupe: 'Compte de résultat' | 'Bilan' | 'Flux de trésorerie' | 'Par action' | 'Ratios';
  /** Les montants se rendent en barres, les ratios et par-action en lignes. */
  render: 'bar' | 'line';
}

export const SERIES_CATALOG: SerieDef[] = [
  { id: 'revenu',        label: 'Chiffre d’affaires',     unit: 'fcfa',        groupe: 'Compte de résultat', render: 'bar' },
  { id: 'rex',           label: 'Résultat d’exploitation', unit: 'fcfa',       groupe: 'Compte de résultat', render: 'bar' },
  { id: 'rn',            label: 'Résultat net',           unit: 'fcfa',        groupe: 'Compte de résultat', render: 'bar' },
  { id: 'totalActif',    label: 'Total actif',            unit: 'fcfa',        groupe: 'Bilan',              render: 'bar' },
  { id: 'capitauxPropres', label: 'Capitaux propres',     unit: 'fcfa',        groupe: 'Bilan',              render: 'bar' },
  { id: 'dettesFin',     label: 'Dettes financières',     unit: 'fcfa',        groupe: 'Bilan',              render: 'bar' },
  { id: 'fluxExploitation', label: 'Flux d’exploitation', unit: 'fcfa',        groupe: 'Flux de trésorerie', render: 'bar' },
  { id: 'fluxInvestissement', label: 'Flux d’investissement', unit: 'fcfa',    groupe: 'Flux de trésorerie', render: 'bar' },
  { id: 'fluxFinancement', label: 'Flux de financement',  unit: 'fcfa',        groupe: 'Flux de trésorerie', render: 'bar' },
  { id: 'bpa',           label: 'BPA',                    unit: 'fcfa_action', groupe: 'Par action',         render: 'line' },
  { id: 'dividende',     label: 'Dividende / action',     unit: 'fcfa_action', groupe: 'Par action',         render: 'line' },
  { id: 'margeNette',    label: 'Marge nette %',          unit: 'pct',         groupe: 'Ratios',             render: 'line' },
  { id: 'margeRex',      label: 'Marge d’exploitation %', unit: 'pct',         groupe: 'Ratios',             render: 'line' },
  { id: 'roe',           label: 'ROE %',                  unit: 'pct',         groupe: 'Ratios',             render: 'line' },
  { id: 'croissanceCa',  label: 'Croissance CA %',        unit: 'pct',         groupe: 'Ratios',             render: 'line' },
];

/** Sélection par défaut — le trio le plus lu (même esprit que Zone Bourse). */
export const DEFAULT_SELECTION = ['revenu', 'rn', 'margeNette'];


const ratio = (num: number | null | undefined, den: number | null | undefined): number | null =>
  num != null && den != null && den !== 0 ? (num / den) * 100 : null;

/**
 * Croise les trois états par période et calcule les ratios dérivés.
 * Sortie triée par période croissante. Un terme manquant donne null — le
 * graphique montre un trou, jamais une invention.
 */
export function buildChartRows(
  income: Pick<IncomeStatement, 'periode' | 'revenu_total' | 'resultat_exploitation' | 'resultat_net' | 'benefice_par_action' | 'dividende_par_action'>[],
  balance: Pick<BalanceSheet, 'periode' | 'total_actifs' | 'total_capitaux_propres' | 'dette_court_terme' | 'dette_long_terme'>[],
  cashflow: Pick<CashFlowStatement, 'periode' | 'flux_exploitation' | 'flux_investissement' | 'flux_financement'>[],
): ChartRow[] {
  const balByPeriode = new Map(balance.map((b) => [b.periode, b]));
  const cfByPeriode = new Map(cashflow.map((c) => [c.periode, c]));
  const tries = [...income].sort((a, b) => a.periode.localeCompare(b.periode));

  return tries.map((s, i) => {
    const bal = balByPeriode.get(s.periode);
    const cf = cfByPeriode.get(s.periode);
    const prev = tries[i - 1];
    const dettes =
      bal?.dette_court_terme != null || bal?.dette_long_terme != null
        ? (bal?.dette_court_terme ?? 0) + (bal?.dette_long_terme ?? 0)
        : null;

    return {
      periode: s.periode,
      revenu: s.revenu_total ?? null,
      rex: s.resultat_exploitation ?? null,
      rn: s.resultat_net ?? null,
      totalActif: bal?.total_actifs ?? null,
      capitauxPropres: bal?.total_capitaux_propres ?? null,
      dettesFin: dettes,
      fluxExploitation: cf?.flux_exploitation ?? null,
      fluxInvestissement: cf?.flux_investissement ?? null,
      fluxFinancement: cf?.flux_financement ?? null,
      bpa: s.benefice_par_action != null ? Number(s.benefice_par_action) : null,
      dividende: s.dividende_par_action != null ? Number(s.dividende_par_action) : null,
      margeNette: ratio(s.resultat_net, s.revenu_total),
      margeRex: ratio(s.resultat_exploitation, s.revenu_total),
      roe: ratio(s.resultat_net, bal?.total_capitaux_propres),
      croissanceCa:
        prev?.revenu_total != null && prev.revenu_total !== 0 && s.revenu_total != null
          ? ((s.revenu_total - prev.revenu_total) / Math.abs(prev.revenu_total)) * 100
          : null,
    };
  });
}

/**
 * Ramène chaque série sélectionnée en base 100 à sa première valeur non nulle.
 * Toutes les séries deviennent alors comparables sur UN seul axe (indice), quelle
 * que soit leur unité — c'est ce qui lève la limite des deux familles d'unités.
 *
 * Honnêteté : on n'invente rien. Une série sans aucun point reste absente ; les
 * trous internes restent des trous (`connectNulls={false}`). La transformation
 * — un simple rebasage — est affichée à l'utilisateur, jamais masquée.
 */
export function normalizeRows(rows: ChartRow[], selectedIds: string[]): ChartRow[] {
  const bases = new Map<string, number>();
  for (const id of selectedIds) {
    const premier = rows.find((r) => {
      const v = r[id as SerieId];
      return typeof v === 'number' && v !== 0;
    });
    const base = premier?.[id as SerieId];
    if (typeof base === 'number' && base !== 0) bases.set(id, base);
  }

  return rows.map((r) => {
    const out: ChartRow = { ...r };
    for (const id of selectedIds) {
      const base = bases.get(id);
      const v = r[id as SerieId];
      // Rebasage sur la valeur absolue de la base : une série qui part d'une
      // perte (base négative) garde le bon sens de variation.
      out[id as SerieId] = base != null && typeof v === 'number' ? (v / Math.abs(base)) * 100 : null;
    }
    return out;
  });
}

export interface AxisPlan {
  /** Classe d'unité de l'axe gauche (null si rien de sélectionné). */
  gauche: UnitClass | null;
  /** Classe d'unité de l'axe droit (null si une seule classe en jeu). */
  droite: UnitClass | null;
  /** ids refusés parce qu'ils imposeraient une 3e classe d'unité. */
  refuses: string[];
}

/**
 * Affecte chaque classe d'unité à un axe, dans l'ordre de sélection.
 * Au plus deux classes : la suivante est refusée (l'UI désactive ses cases).
 */
export function planAxes(selectedIds: string[]): AxisPlan {
  // Map cle string : les selections viennent de l'UI (useState<string[]>).
  const defs = new Map<string, SerieDef>(SERIES_CATALOG.map((s) => [s.id, s]));
  const classes: UnitClass[] = [];
  const refuses: string[] = [];
  for (const id of selectedIds) {
    const def = defs.get(id);
    if (!def) continue;
    if (classes.includes(def.unit)) continue;
    if (classes.length < 2) classes.push(def.unit);
    else refuses.push(id);
  }
  return { gauche: classes[0] ?? null, droite: classes[1] ?? null, refuses };
}

/**
 * Une série candidate est-elle cochable, vu la sélection courante ?
 * Oui si sa classe d'unité est déjà sur un axe, ou s'il reste un axe libre.
 */
export function peutAjouter(selectedIds: string[], candidatId: string): boolean {
  const def = SERIES_CATALOG.find((s) => s.id === candidatId);
  if (!def) return false;
  const { gauche, droite } = planAxes(selectedIds);
  return gauche === null || droite === null || def.unit === gauche || def.unit === droite;
}
