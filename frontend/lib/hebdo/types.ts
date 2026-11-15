import type { Levels } from './levels';

/** Entrée de sélection : une valeur avec sa semaine et son historique. */
export interface HebdoCandidate {
  code: string;
  /** Clôtures chronologiques (≥ 32 points requis pour être retenu). */
  closes: number[];
  /** Variation de la semaine, en %. */
  variationHebdo: number | null;
  /** Volume de la dernière séance. */
  volume: number | null;
  /** Volume moyen 20 séances. */
  avgVolume20: number | null;
}

export interface HebdoPick {
  code: string;
  sens: 'hausse' | 'baisse';
  raison: string;
  score: number;
}

/** Snapshot figé stocké dans hebdo_items.metrics (rendu de la page). */
export interface HebdoMetrics {
  code: string;
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  dernier: number;
  variationHebdo: number | null;
  volume: number | null;
  ratioVolume: number | null;
  rsiDernier: number | null;
  macdPositif: boolean | null;
  levels: Levels | null;
  /** Analyse enrichie (édition ≥ 2026-11-15). Absente des snapshots antérieurs :
   *  le narratif n'affiche alors que les sections historiques. */
  analyse?: HebdoAnalyse;
}

/**
 * Données FIGÉES au moment de l'édition, une par bloc du narratif. Chaque champ
 * est lu ou calculé en base ; un champ inconnu vaut null et la phrase qui en
 * dépend disparaît. Le texte publié ne relit jamais la base.
 */
export interface HebdoAnalyse {
  version: 2;
  /** Pas de cotation retenu pour arrondir les niveaux (5 ou 1 FCFA). */
  pas: number;
  /** Marge de sortie de canal, en %. */
  margePct: number;
  /** Semaine calendaire de l'édition et clôture de référence (séance précédente). */
  semaine: { debut: string; fin: string; seances: number; dateReference: string | null };
  /** Variation hebdomadaire du BRVM Composite, même référence. */
  marche: { libelle: string; variation: number } | null;
  /** Secteur de la valeur et son indice sectoriel BRVM sur la semaine. */
  secteur: { nom: string; indice: { libelle: string; variation: number } | null } | null;
  /** Position sur un an. */
  annee: {
    haut52: number | null;
    bas52: number | null;
    /** Variation depuis la dernière clôture de l'année précédente. */
    depuisJanvier: number | null;
    dateRefJanvier: string | null;
  };
  liquidite: {
    /** Dernière séance. */
    titresSeance: number | null;
    valeurSeance: number | null;
    /** Cumul de la semaine. */
    titresSemaine: number | null;
    valeurSemaine: number | null;
    /** Part de la valeur échangée sur toute la cote cette semaine, en %. */
    partMarchePct: number | null;
    /** Moyenne quotidienne sur 30 séances (liquidity_daily). */
    valeurMoyenne30j: number | null;
    classe: 'A' | 'B' | 'C' | 'D' | null;
    libelleClasse: string | null;
    carnet: CarnetFige | null;
  };
  /** PER sur le résultat net consolidé ; null si les comptes ne sont pas fiables. */
  valorisation: { exercice: string; bpa: number; per: number; perMedianeSecteur: number | null; nbPairsPer: number } | null;
  /** Dernier dividende NET connu (calendrier officiel). */
  dividende: { exercice: number; montant: number; rendementPct: number; rendementMedianeSecteur: number | null; nbPairs: number } | null;
  /** Qualité du dernier bénéfice annuel. */
  benefice: {
    exercice: string;
    resultatNet: number;
    variationNetPct: number | null;
    resultatExploitation: number | null;
    variationExploitationPct: number | null;
    resultatAvantImpots: number | null;
    /** (RAI − résultat d'exploitation) / RAI, en % ; null si l'un manque ou RAI ≤ 0. */
    partHorsExploitationPct: number | null;
  } | null;
  /** Faits datés de la semaine, et détachements / paiements à venir sous 30 jours. */
  evenements: EvenementFige[];
}

export interface CarnetFige {
  date: string;
  coursAchat: number | null;
  coursVente: number | null;
  achatAuMarche: boolean;
  venteAuMarche: boolean;
  /** (vente − achat) / milieu, en % ; null si un côté manque ou est « au marché ». */
  fourchettePct: number | null;
}

export interface EvenementFige {
  date: string;
  nature: 'publication' | 'detachement' | 'paiement' | 'operation' | 'actualite';
  libelle: string;
  aVenir: boolean;
}

/** Éclairages optionnels injectés dans le narratif (spec §3 et §4). */
export interface HebdoContexte {
  fondamental: { phrase: string; chiffres: number[] } | null;
  evenement: { phrase: string; chiffres: number[] } | null;
}
