import type { CleFait } from './types';

/** À incrémenter à chaque changement : l'évaluation note la version mesurée. */
export const VERSION_DICTIONNAIRE = '2026-11-04.1';

/** Une expression renvoie soit à un champ (phrase normalisée à y trouver), soit à la présence d'un fait. */
export type Cible = { champ: 'activite' | 'secteur' | 'pays'; jetons: string[] } | { fait: CleFait };

const secteur = (...jetons: string[]): Cible[] => [{ champ: 'secteur', jetons }];
const pays = (phrase: string): Cible[] => [{ champ: 'pays', jetons: [phrase] }];
const activite = (valeur: 'banque' | 'assurance'): Cible[] => [{ champ: 'activite', jetons: [valeur] }];
const fait = (cle: CleFait): Cible[] => [{ fait: cle }];

/** Clés = mots NORMALISÉS (sans accents, minuscules). */
export const DICTIONNAIRE: Record<string, Cible[]> = {
  banque: activite('banque'),
  banques: activite('banque'),
  bancaire: activite('banque'),
  bancaires: activite('banque'),
  assurance: activite('assurance'),
  assurances: activite('assurance'),
  assureur: activite('assurance'),
  assureurs: activite('assurance'),
  telecom: secteur('telecommunications'),
  telecoms: secteur('telecommunications'),
  telecommunication: secteur('telecommunications'),
  telecommunications: secteur('telecommunications'),
  operateur: secteur('telecommunications'),
  operateurs: secteur('telecommunications'),
  telephonie: secteur('telecommunications'),
  telephonique: secteur('telecommunications'),
  energie: secteur('energie'),
  petrole: secteur('energie'),
  petrolier: secteur('energie'),
  petroliere: secteur('energie'),
  carburant: secteur('energie'),
  industrie: secteur('industriels'),
  industriel: secteur('industriels'),
  industrielle: secteur('industriels'),
  industriels: secteur('industriels'),
  agroalimentaire: secteur('consommation de base'),
  alimentaire: secteur('consommation de base'),
  agricole: secteur('consommation de base'),
  eau: secteur('services publics'),
  electricite: secteur('services publics'),
  financier: secteur('services financiers'),
  financiere: secteur('services financiers'),
  financiers: secteur('services financiers'),
  finance: secteur('services financiers'),
  dividende: fait('rendement'),
  dividendes: fait('rendement'),
  rendement: fait('rendement'),
  distribue: fait('rendement'),
  liquide: fait('liquidite'),
  liquides: fait('liquidite'),
  liquidite: fait('liquidite'),
  echangee: fait('liquidite'),
  performance: fait('perf12m'),
  ivoire: pays('cote d ivoire'),
  ivoirien: pays('cote d ivoire'),
  ivoirienne: pays('cote d ivoire'),
  senegal: pays('senegal'),
  senegalais: pays('senegal'),
  senegalaise: pays('senegal'),
  burkina: pays('burkina faso'),
  burkinabe: pays('burkina faso'),
  mali: pays('mali'),
  malien: pays('mali'),
  malienne: pays('mali'),
  benin: pays('benin'),
  beninois: pays('benin'),
  beninoise: pays('benin'),
  togo: pays('togo'),
  togolais: pays('togo'),
  togolaise: pays('togo'),
  niger: pays('niger'),
  nigerien: pays('niger'),
  nigerienne: pays('niger'),
};

/** Mots qui n'informent pas la recherche. */
export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'au', 'aux', 'en', 'dans', 'pour', 'avec',
  'qui', 'que', 'quoi', 'est', 'sont', 'sur', 'par', 'plus', 'tres', 'bon', 'bonne', 'bons', 'bonnes', 'gros',
  'grosse', 'fort', 'forte', 'eleve', 'elevee', 'eleves', 'elevees', 'societe', 'societes', 'entreprise',
  'entreprises', 'action', 'actions', 'valeur', 'valeurs', 'titre', 'titres', 'je', 'cherche', 'veux', 'mais',
  'verse', 'versent', 'an', 'secteur', 'cote', 'mois', '12',
]);

/** Le mot significatif qui SUIT une négation est exclu, pas favorisé. */
export const NEGATIONS = new Set(['hors', 'sauf', 'sans', 'ni', 'pas', 'non', 'excepte']);
