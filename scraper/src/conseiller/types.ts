/** Types du Conseiller v2. Voir docs/superpowers/specs/2026-11-09-conseiller-v2-design.md. */

export type FamilleComptable = 'banque' | 'general';
export type FamilleFacteur = 'valorisation' | 'qualite' | 'rendement' | 'tendance' | 'risque';
export const FAMILLES_FACTEURS: FamilleFacteur[] = ['valorisation', 'qualite', 'rendement', 'tendance', 'risque'];

/** Série d'une valeur, triée par date croissante. `volumes[i] > 0` = séance échangée. */
export interface Serie {
  dates: string[];
  cours: number[];
  volumes: number[];
  valeurs: number[];
  variations: (number | null)[];
  pos: Map<string, number>;
}

export interface ComptesAnnuels {
  code: string;
  exercice: number;
  resultatNet: number | null;
  capitauxPropres: number | null;
  actions: number | null;
  /** Première date (ISO) où ces comptes sont connus du public. */
  disponibleLe: string;
}

export interface Dividende {
  code: string;
  exercice: number;
  montant: number;
  /** Première date où le montant est connu (31 juillet N+1). */
  disponibleLe: string;
  /** Date de détachement, réelle ou reconstituée ; null si inconnue. */
  exDate: string | null;
}

export interface Donnees {
  /** Toutes les dates de séance du marché, triées. */
  calendrier: string[];
  series: Map<string, Serie>;
  comptes: ComptesAnnuels[];
  dividendes: Dividende[];
  familles: Map<string, FamilleComptable>;
}

export type Action = 'acheter' | 'conserver' | 'vendre';

export interface Decision {
  code: string;
  date: string;
  action: Action;
  scores: Record<FamilleFacteur, number | null>;
  /** Familles concordantes avec l'action (0 si conserver). */
  concordantes: number;
  disponibles: number;
  raison: 'concordance' | 'liquidite' | 'abstention' | 'pas_de_concordance';
}
