/* ──────────────────────────────────────────────────────────────────────────
   Simulateur de budget BRVM — logique pure et testable.

   À partir d'un budget, de frais de courtage SGI et d'un univers d'actions
   (cours réels + rendement dividende + perf 12 mois issus de Supabase), compose
   trois portefeuilles : « Dividende max », « Croissance », « Équilibré ».

   Honnêteté des données : chaque stratégie n'utilise QUE les actions pour
   lesquelles la métrique dont elle dépend est connue (rendement / perf12).
   Aucune valeur n'est inventée ; une action sans la métrique requise est
   simplement écartée de la stratégie concernée.
   ────────────────────────────────────────────────────────────────────────── */

import { BAREME } from './tax/rates';

/**
 * Taux IRVM utilisé par le simulateur (approximation mono-taux : les émetteurs
 * BRVM sont majoritairement ivoiriens). Dérivé du barème sourcé (lib/tax) ;
 * repli 0.10 si le taux CI n'était plus confirmé.
 */
export const IRVM = BAREME.CI.dividende_cote.taux ?? 0.1;

export interface SimAction {
  code: string;
  designation: string;
  secteur: string | null;
  /** Dernier cours de clôture en FCFA (> 0). */
  prix: number;
  /** Rendement du dividende en % (dividende annuel / cours), ou null si inconnu. */
  rendement: number | null;
  /** Performance sur 12 mois en %, ou null si l'historique est insuffisant. */
  perf12: number | null;
}

export type StrategyKey = 'div' | 'cro' | 'eq';

export interface StrategyMeta {
  key: StrategyKey;
  nom: string;
  tag: string;
  /** True = stratégie mise en avant par défaut pour un débutant. */
  reco: boolean;
  desc: string;
  /** Métrique requise pour qu'une action soit éligible à cette stratégie. */
  requires: ('rendement' | 'perf12')[];
  /** Score de tri (plus haut = prioritaire). L'action passe le filtre `requires`. */
  score: (a: SimAction) => number;
}

export const STRATEGIES: StrategyMeta[] = [
  {
    key: 'div',
    nom: 'Dividende max',
    tag: 'Revenus réguliers',
    reco: false,
    desc: 'Maximise le revenu : priorité aux meilleurs rendements de dividende. Pour un flux passif régulier.',
    requires: ['rendement'],
    score: (a) => a.rendement ?? -Infinity,
  },
  {
    key: 'cro',
    nom: 'Croissance',
    tag: 'Plus-value',
    reco: false,
    desc: 'Vise la valorisation : priorité aux meilleures performances sur 12 mois. Orienté capital.',
    requires: ['perf12'],
    score: (a) => a.perf12 ?? -Infinity,
  },
  {
    key: 'eq',
    nom: 'Équilibré',
    tag: 'Recommandé débutant',
    reco: true,
    desc: 'Combine revenu et croissance (score = rendement + perf 12 mois). Profil polyvalent.',
    requires: ['rendement', 'perf12'],
    score: (a) => (a.rendement ?? 0) + (a.perf12 ?? 0),
  },
];

/** Une ligne du portefeuille : une action et la quantité achetée. */
export interface AllocLine {
  action: SimAction;
  qty: number;
  /** Montant investi en titres (hors frais) = qty × prix. */
  montant: number;
}

export interface StrategyResult {
  key: StrategyKey;
  lines: AllocLine[];
  /** Montant investi en titres (hors frais). */
  investiTitres: number;
  /** Frais de courtage totaux. */
  frais: number;
  /** Investi titres + frais. */
  investiTotal: number;
  /** Liquidités restantes après allocation. */
  reste: number;
  /** Dividendes annuels bruts attendus. */
  divBrut: number;
  /** Dividendes annuels nets d'IRVM si l'option est active, sinon = divBrut. */
  divNet: number;
  /** Rendement net du portefeuille (divNet / investiTitres), en %. */
  rendNet: number;
  /** Performance 12 mois pondérée par le montant, en %. */
  perfMoy: number;
  /** Retour total estimé (dividendes nets + plus-value 12 mois théorique). */
  retourTotal: number;
  /** Nombre d'actions éligibles à cette stratégie dans l'univers fourni. */
  eligibleCount: number;
}

function isEligible(a: SimAction, requires: StrategyMeta['requires']): boolean {
  if (a.prix <= 0) return false;
  return requires.every((m) => a[m] != null);
}

/** Sélectionne jusqu'à `n` actions selon le score, optionnellement 1 par secteur d'abord. */
export function select(
  univers: SimAction[],
  meta: StrategyMeta,
  n: number,
  diversify: boolean,
): SimAction[] {
  const eligible = univers.filter((a) => isEligible(a, meta.requires));
  const sorted = eligible.slice().sort((a, b) => meta.score(b) - meta.score(a));
  if (!diversify) return sorted.slice(0, n);

  const pick: SimAction[] = [];
  const seen = new Set<string>();
  for (const a of sorted) {
    if (pick.length >= n) break;
    const sec = a.secteur ?? '∅';
    if (!seen.has(sec)) {
      seen.add(sec);
      pick.push(a);
    }
  }
  // Complète avec les meilleurs restants si on n'a pas atteint n.
  for (const a of sorted) {
    if (pick.length >= n) break;
    if (!pick.includes(a)) pick.push(a);
  }
  return pick;
}

/**
 * Alloue le budget sur la sélection : cible égale par ligne, achat d'un titre
 * entier à la fois, puis réutilisation du reliquat (rachat tant que possible,
 * en respectant l'ordre de la sélection = ordre de score).
 * `fee` est le taux de courtage en décimal (ex. 0.012 pour 1,2 %).
 */
export function allocate(sel: SimAction[], budget: number, fee: number): AllocLine[] {
  if (sel.length === 0 || budget <= 0) return [];
  const cost = (a: SimAction) => a.prix * (1 + fee);
  const lines = sel.map((a) => ({ action: a, qty: 0, montant: 0 }));
  const target = budget / sel.length;

  for (const l of lines) l.qty = Math.max(0, Math.floor(target / cost(l.action)));
  let spent = lines.reduce((t, l) => t + l.qty * cost(l.action), 0);
  let reste = budget - spent;

  // Reliquat : rachète 1 titre tant qu'un cours tient dans le reste.
  let guard = 0;
  while (guard++ < 100_000) {
    const cand = lines.find((l) => cost(l.action) <= reste + 1e-6);
    if (!cand) break;
    cand.qty++;
    reste -= cost(cand.action);
  }

  for (const l of lines) l.montant = l.qty * l.action.prix;
  return lines.filter((l) => l.qty > 0);
}

/** Compose une stratégie complète à partir de l'univers et des paramètres. */
export function computeStrategy(
  meta: StrategyMeta,
  univers: SimAction[],
  n: number,
  budget: number,
  fee: number,
  diversify: boolean,
  netTax: boolean,
): StrategyResult {
  const eligibleCount = univers.filter((a) => isEligible(a, meta.requires)).length;
  const sel = select(univers, meta, n, diversify);
  const lines = allocate(sel, budget, fee);

  let investiTitres = 0;
  let frais = 0;
  let divBrut = 0;
  let perfPond = 0;
  for (const l of lines) {
    const m = l.montant;
    investiTitres += m;
    frais += m * fee;
    if (l.action.rendement != null) divBrut += (m * l.action.rendement) / 100;
    if (l.action.perf12 != null) perfPond += (m * l.action.perf12) / 100;
  }

  const investiTotal = investiTitres + frais;
  const reste = budget - investiTotal;
  const divNet = netTax ? divBrut * (1 - IRVM) : divBrut;
  const rendNet = investiTitres > 0 ? (divNet / investiTitres) * 100 : 0;
  const perfMoy = investiTitres > 0 ? (perfPond / investiTitres) * 100 : 0;
  const retourTotal = divNet + perfPond;

  return {
    key: meta.key,
    lines,
    investiTitres,
    frais,
    investiTotal,
    reste,
    divBrut,
    divNet,
    rendNet,
    perfMoy,
    retourTotal,
    eligibleCount,
  };
}
