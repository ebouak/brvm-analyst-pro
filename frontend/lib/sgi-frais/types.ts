/**
 * Modèle de confiance à 3 niveaux — jamais présenter une donnée comme plus
 * fiable qu'elle ne l'est :
 * - homologue_crepmf : lu directement dans une décision d'homologation
 *   individuelle publiée sur brvm.org (le niveau le plus fiable).
 * - agrege_public : agrégé de sources publiques (SikaFinance, RichBourse),
 *   à confirmer auprès de la SGI.
 * - saisie_utilisateur : aucune donnée publique trouvée, saisie manuelle.
 */
export type ConfianceNiveau = 'homologue_crepmf' | 'agrege_public' | 'saisie_utilisateur';

export type Frequence = 'annuel' | 'trimestriel' | 'semestriel';

export interface SgiFrais {
  sgiNom: string; // clé texte = nom exact dans SgiComparator.tsx

  courtagePctMin: number | null;
  courtagePctMax: number | null;
  minimumPerception: number | null;

  droitsGardePctMin: number | null;
  droitsGardePctMax: number | null;
  droitsGardeFrequence: Frequence | null;
  /** Plancher par période (ex. 2 500 FCFA/trimestre) — remplace le taux
   * proportionnel s'il est plus élevé, comme `minimumPerception` pour le
   * courtage. Certaines SGI (ex. Sogebourse) publient une seule ligne
   * « droits de garde » avec un plancher intégré plutôt que deux lignes
   * distinctes garde + tenue de compte. */
  droitsGardeMinimum: number | null;

  tenueCompteMontant: number | null;
  tenueCompteFrequence: Exclude<Frequence, 'semestriel'> | null;

  fraisVirement: number | null;
  depotMinimum: number | null;
  gestionSousMandatPctMin: number | null;
  gestionSousMandatPctMax: number | null;

  confiance: ConfianceNiveau;
  sourceUrl: string | null;
  sourceLabel: string | null;
  verifieLe: string | null; // YYYY-MM-DD
  notes: string | null;
}

export const CONFIANCE_LABEL: Record<ConfianceNiveau, string> = {
  homologue_crepmf: 'Barème homologué CREPMF',
  agrege_public: 'Donnée agrégée — à confirmer',
  saisie_utilisateur: 'Estimation saisie par vous',
};

export const CONFIANCE_BADGE_CLASS: Record<ConfianceNiveau, string> = {
  homologue_crepmf: 'bg-up/15 text-up border-up/30',
  agrege_public: 'bg-info/15 text-info border-info/30',
  saisie_utilisateur: 'bg-warn/15 text-warn border-warn/30',
};
