/** Types du module articles (spec docs/superpowers/specs/2026-10-28-articles-presse-design.md). */
export type TypeArticle =
  | 'dividende_annonce'
  | 'detachement_rappel'
  | 'paiement_rappel'
  | 'operation_titres'
  | 'seance_hors_norme';

/** Lot 1 : tous publiés sans relecture. Résultats, notations et thèmes (lots 2-3) passeront par la validation. */
export const TYPES_AUTOMATIQUES: ReadonlySet<string> = new Set<TypeArticle>([
  'dividende_annonce',
  'detachement_rappel',
  'paiement_rappel',
  'operation_titres',
  'seance_hors_norme',
]);

export interface DividendeRow {
  code: string;
  exercice: number | null;
  montant: number | null;
  ex_date: string | null;
  payment_date: string | null;
  source: string | null;
  created_at: string;
}

export interface CoursRow {
  code: string;
  date_marche: string;
  cours_jour: number | null;
  cours_precedent: number | null;
  variation_pct: number | null;
  volume: number | null;
  valeur_echangee: number | null;
  cours_haut_52s: number | null;
  cours_bas_52s: number | null;
}

export interface OperationRow {
  code: string;
  date_effet: string;
  type: 'fractionnement' | 'regroupement';
  ratio: number;
}

export interface IndiceRow {
  code: string;
  valeur: number | null;
  variation_pct: number | null;
}

/** Plus forte valeur échangée AVANT la séance, et début de l'historique en base. */
export interface RecordValeur {
  valeur: number;
  date: string;
  depuis: string;
}

export interface Contexte {
  aujourdhui: string; // AAAA-MM-JJ (UTC = heure d'Abidjan)
  derniereSeance: string;
  noms: Record<string, string>; // code → désignation
  cours: Record<string, CoursRow>; // dernière séance
  historique: Record<string, CoursRow[]>; // séances AVANT la dernière, ordre croissant
  indices?: IndiceRow[];
  actions?: Record<string, number | null>; // code → nombre d'actions
  recordsValeur?: Record<string, RecordValeur>;
}

/**
 * Repères « thèse » d'une valeur (skill thesis-tracker) : des FAITS, jamais
 * une recommandation. Chargés par le runner pour la valeur d'un article.
 */
export interface Reperes {
  bpa: number | null;
  exercice_bpa: string | null;
  dividendes: { exercice: number; montant: number }[]; // du plus récent au plus ancien
  liquidite_classe: string | null;
  liquidite_score: number | null;
  signal: string | null;
}

export type DonneesFait = Record<string, unknown>;

export interface Fait {
  type: TypeArticle;
  code: string;
  cle: string; // exercice, date d'effet ou séance
  dateFait: string; // date de l'événement
  donnees: DonneesFait;
}

/**
 * Clé de dédoublonnage : un même fait ne produit jamais deux articles.
 * La séance est UNE par jour, quelle que soit la valeur mise en avant : si la
 * donnée change d'angle entre deux passages, on ne publie pas un second article.
 */
export const cleFait = (f: Fait): string =>
  f.type === 'seance_hors_norme' ? `${f.type}|${f.cle}` : `${f.type}|${f.code}|${f.cle}`;
