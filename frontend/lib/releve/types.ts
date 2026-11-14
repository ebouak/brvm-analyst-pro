/**
 * Contrat de `monthly_reports.report_json` — version 2.
 *
 * FIGÉ à la génération : la page /rapports/releve/[id] ne lit que ce document
 * (plus des cours de marché publics pour les réactions). Elle ne relit JAMAIS
 * `portfolios_positions`. ⚠️ Copie de `scraper/src/releve/types.ts` (deux paquets
 * TS distincts, pas de module partagé) : toute modification se reporte des
 * deux côtés.
 */

export type TypeReleve = 'reel' | 'simule';
export type BaseFiscale = 'net' | 'brut' | 'inconnu';

export interface LigneReleve {
  code: string;
  designation: string;
  secteur: string | null;
  quantite: number;
  /** Cours de départ (dernière clôture avant le mois) ; null si la ligne a été ouverte dans le mois. */
  cours_depart: number | null;
  /** Dernier cours connu à la fin du mois. */
  cours_fin: number;
  /** Date de ce dernier cours. Antérieure au mois = aucune cotation dans le mois. */
  date_cours: string;
  valeur_depart: number;
  valeur_fin: number;
  variation: number;
  /** Variation de la ligne, en % de sa valeur de départ. */
  variation_pct: number | null;
  /** Part de la ligne dans la variation du portefeuille, en points de pourcentage. */
  contribution_pts: number | null;
  /** Poids dans la valeur de fin de mois, en %. */
  poids_pct: number | null;
  ouverte_dans_mois: boolean;
  soldee_dans_mois: boolean;
}

export interface LigneExclue {
  code: string;
  designation: string;
  motif: string;
}

export interface DividendeReleve {
  code: string;
  designation: string;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant_par_action: number;
  quantite: number;
  /** Montant × quantité. null pour un relevé simulé (le simulateur ne crédite aucun dividende). */
  montant_total: number | null;
  base_fiscale: BaseFiscale;
}

export interface TotalDividendes {
  /** null quand les lignes n'ont pas la même base fiscale : on n'additionne pas du net et du brut. */
  montant: number | null;
  base: BaseFiscale | null;
  nb: number;
}

export interface PublicationReleve {
  date: string;
  code: string;
  designation: string;
  titre: string;
  type: string | null;
}

export interface RendezVousReleve {
  type: 'detachement' | 'paiement' | 'assemblee';
  date: string;
  code: string;
  designation: string;
  libelle: string;
  /** Dividende par action pour un détachement / paiement. */
  montant_par_action: number | null;
  montant_total: number | null;
  base_fiscale: BaseFiscale | null;
}

export interface ReleveJson {
  version: 2;
  type: TypeReleve;
  titre: string;
  mois: string; // AAAA-MM
  genere_le: string;
  debut: string;
  fin: string;
  derniere_seance: string | null;
  resume: {
    valeur_depart: number | null;
    valeur_fin: number | null;
    variation: number | null;
    variation_pct: number | null;
    nb_lignes: number;
    nb_exclues: number;
  };
  lignes: LigneReleve[];
  exclues: LigneExclue[];
  /** null pour un relevé simulé. */
  dividendes: { detaches: DividendeReleve[]; encaisses: DividendeReleve[]; total_detaches: TotalDividendes; total_encaisses: TotalDividendes } | null;
  publications: { liste: PublicationReleve[]; non_listees: number };
  concentration: {
    premiere_ligne: { code: string; designation: string; poids_pct: number } | null;
    premier_secteur: { secteur: string; poids_pct: number } | null;
    /** Part (en %) de la valeur de fin de mois dont le secteur n'est pas renseigné. */
    sans_secteur_pct: number | null;
  };
  rendez_vous: RendezVousReleve[];
}
