/** Contrat de la recherche en langage naturel parmi les sociétés. */

export type CleFait = 'activite' | 'secteur' | 'pays' | 'rendement' | 'liquidite' | 'perf12m';

export interface FaitSociete {
  cle: CleFait;
  libelle: string;
  valeur: string;
}

export interface FicheSociete {
  code: string;
  nom: string;
  faits: FaitSociete[];
  /** Texte envoyé à Jev : uniquement des faits en base. */
  texte: string;
}

export interface Instantane {
  /** Date de séance + empreinte des fiches : change dès qu'un fait change. */
  snapshotId: string;
  /** AAAA-MM-JJ, date de la séance. */
  actualiseLe: string;
  fiches: FicheSociete[];
}

export type ModeRecherche = 'jev' | 'mots-cles';

export type RaisonRepli =
  | 'non_connecte'
  | 'offre_non_eligible'
  | 'quota_atteint'
  | 'plafond_atteint'
  | 'compteur_indisponible'
  | 'jev_indisponible'
  | 'donnees_indisponibles';

export type StatutRecherche = 'correspondance' | 'partielle' | 'aucune';

export interface ResultatRecherche {
  code: string;
  nom: string;
  score: number;
  faits: FaitSociete[];
}

export interface ReponseRecherche {
  mode: ModeRecherche;
  /** null ⇔ mode 'jev'. */
  raison: RaisonRepli | null;
  cache: boolean;
  statut: StatutRecherche;
  resultats: ResultatRecherche[];
  snapshotId: string | null;
  actualiseLe: string | null;
}

/** Réponse de Jev après validation : un score par code, plus la pertinence globale. */
export interface ResultatJevValide {
  scores: Record<string, number>;
  pertinenceGlobale: number;
  modele: string;
}

export interface CleCache {
  empreinte: string;
  snapshotId: string;
}
