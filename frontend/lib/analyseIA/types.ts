/**
 * Contrat d'« Analyse par IA » (fiche action) : événements du flux entre la
 * route `/api/analyse-ia` et le composant, et formes des données lues en base.
 * Types seuls, partagés client et serveur.
 */

/** `jev` : réponse type-safe, gabarit + chiffres lus en base, sans LLM. `ia` : rédigée par un LLM à partir des outils. */
export type Provenance = 'jev' | 'ia';

/** Une donnée réellement consultée, avec la date de son élément le plus récent. */
export interface SourceDonnee {
  libelle: string;
  /** AAAA-MM-JJ, ou null si la donnée n'en porte pas. */
  date: string | null;
}

export interface MetaReponse {
  provenance: Provenance;
  sources: SourceDonnee[];
  relances: string[];
}

export type CodeErreur = 'connexion' | 'acces' | 'quota' | 'saisie' | 'indisponible' | 'interne';

export type EvenementFlux =
  | { type: 'etape'; libelle: string }
  | { type: 'texte'; texte: string }
  | { type: 'meta'; meta: MetaReponse }
  | { type: 'erreur'; code: CodeErreur; message: string };

export interface MessageConversation {
  role: 'user' | 'assistant';
  content: string;
}

/* ------------------------------------------------ données lues en base */

export interface CoursJour {
  code: string;
  societe: string | null;
  seance: string;
  cours: number | null;
  variation_pct: number | null;
  cours_precedent: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

export interface PointCours {
  date: string;
  cours: number;
  volume: number | null;
  variation_pct: number | null;
}

export interface Actualite {
  titre: string;
  date: string;
  source: string | null;
}

export interface Publication {
  libelle: string;
  date: string;
  type: string | null;
}

export interface LigneDividende {
  exercice: number;
  montant: number;
  devise: string | null;
  ex_date: string | null;
  payment_date: string | null;
  base_fiscale: string | null;
}

export interface ComptesExercice {
  exercice: number;
  revenu_total: number | null;
  resultat_exploitation: number | null;
  resultat_net: number | null;
  total_actifs: number | null;
  capitaux_propres: number | null;
  dette_financiere: number | null;
  tresorerie: number | null;
}

export interface MesureLiquidite {
  date: string;
  score: number | null;
  classe: string | null;
  presence_pct: number | null;
  valeur_moyenne_30j: number | null;
  spread_pct: number | null;
  spread_source: string | null;
}

export interface CoteCarnet {
  au_marche: boolean;
  cours: number | null;
  quantite: number | null;
}

export interface CarnetSeance {
  date: string;
  achat: CoteCarnet | null;
  vente: CoteCarnet | null;
}
