import type { DossierValeur } from './build';

export interface MesureApercu {
  libelle: string;
  valeur: number | null;
  nature: 'fcfa' | 'pourcent' | 'multiple' | 'nombre';
}

export interface PageApercu {
  numero: 1 | 2;
  code: string;
  designation: string;
  secteur: string | null;
  pays: string | null;
  exercice: string | null;
  genereLe: string;
  mesures: MesureApercu[];
}

export interface ApercuDossier {
  titre: string;
  chapo: string;
  pages: [PageApercu, PageApercu];
}

export function construireApercu(dossier: DossierValeur): ApercuDossier {
  const designation = dossier.identite.designation ?? dossier.identite.code;
  const mesures: MesureApercu[] = [
    { libelle: 'Cours', valeur: dossier.chiffres_cles.cours, nature: 'fcfa' },
    { libelle: 'Capitalisation', valeur: dossier.chiffres_cles.capitalisation, nature: 'fcfa' },
    { libelle: 'Chiffre d’affaires', valeur: dossier.chiffres_cles.chiffre_affaires, nature: 'fcfa' },
    { libelle: 'Résultat net', valeur: dossier.chiffres_cles.resultat_net, nature: 'fcfa' },
    { libelle: 'Capitaux propres', valeur: dossier.chiffres_cles.capitaux_propres, nature: 'fcfa' },
    { libelle: 'Dividende', valeur: dossier.dividende.montant, nature: 'fcfa' },
    { libelle: 'Rendement du dividende', valeur: dossier.dividende.rendement, nature: 'pourcent' },
    { libelle: 'PER', valeur: dossier.ratios?.per ?? null, nature: 'multiple' },
  ];
  const base = {
    code: dossier.identite.code,
    designation,
    secteur: dossier.identite.secteur,
    pays: dossier.identite.pays,
    exercice: dossier.chiffres_cles.exercice,
    genereLe: dossier.genere_le,
  };

  return {
    titre: `${designation} : le dossier pour lire au-delà du cours`,
    chapo:
      'Une lecture structurée de l’entreprise cotée : identité, chiffres clés, valorisation, dividende et qualité des données, avant d’entrer dans les risques et les niveaux de surveillance.',
    pages: [
      { ...base, numero: 1, mesures: [] },
      { ...base, numero: 2, mesures },
    ],
  };
}
