/**
 * Annuaire des SGI BRVM — pays, type, groupe, dépôt minimum indicatif.
 * Extrait de components/landing/SgiComparator.tsx (source canonique de
 * l'annuaire) pour être importable à la fois par SgiComparator (affichage
 * annuaire) et CalculateurCout (jointure pays/type/fiche) sans dépendance
 * circulaire entre les deux composants.
 *
 * `nom` doit correspondre EXACTEMENT à `sgiNom` dans lib/sgi-frais/seed-data.ts.
 */

export interface Pays {
  nom: string;
  iso: string;
}

export const PAYS: Record<string, Pays> = {
  CI: { nom: "Côte d'Ivoire", iso: 'ci' },
  SN: { nom: 'Sénégal', iso: 'sn' },
  BF: { nom: 'Burkina Faso', iso: 'bf' },
  ML: { nom: 'Mali', iso: 'ml' },
  BJ: { nom: 'Bénin', iso: 'bj' },
  TG: { nom: 'Togo', iso: 'tg' },
  NE: { nom: 'Niger', iso: 'ne' },
};

export interface Sgi {
  nom: string;
  pays: keyof typeof PAYS;
  /** 'Non déterminé' = agrément confirmé (BRVM) mais adossement bancaire non
   * vérifié — jamais deviné à partir du nom. */
  type: 'Banque' | 'Indépendante' | 'Non déterminé';
  /** 'Non renseigné' quand l'affiliation n'est pas connue (jamais inventée). */
  groupe: string;
  logo?: string;
  depotMin: string;
  /** 'indicatif' = ordre de grandeur ; 'relevé' = constaté, à reconfirmer ;
   * 'inconnu' = aucune donnée trouvée (jamais de valeur inventée). */
  depotMinSource: 'indicatif' | 'relevé' | 'inconnu';
  siteWeb?: string;
  ficheBRVM?: string;
  /** Contacts collectés (RichBourse) — absents des fichiers TS seed. */
  telephone?: string;
  email?: string;
}

export const SGI_DIRECTORY: Sgi[] = [
  { nom: 'Atlantique Finance', pays: 'CI', type: 'Banque', groupe: 'Groupe Banque Atlantique', logo: '/sgi/atlantique-finance.svg', depotMin: '2 000 000 FCFA', depotMinSource: 'relevé', siteWeb: 'https://www.atlantiquefinance.net', ficheBRVM: 'https://www.brvm.org/fr/sgi-atlantique-finance', telephone: '+225 27 20 31 21 21', email: 'atlantiquefinance@banqueatlantique.net' },
  { nom: 'BICI Bourse', pays: 'CI', type: 'Banque', groupe: 'BICICI · BNP Paribas', logo: '/sgi/bici-bourse.svg', depotMin: 'Pas de minimum', depotMinSource: 'relevé', siteWeb: 'https://www.bicibourse.ci', ficheBRVM: 'https://www.brvm.org/fr/sgi-bici-bourse' },
  { nom: 'BNI Finances', pays: 'CI', type: 'Banque', groupe: "Banque Nationale d'Investissement", logo: '/sgi/bni-finances.svg', depotMin: '1 000 000 FCFA', depotMinSource: 'relevé', siteWeb: 'https://www.bni.ci' },
  { nom: 'BOA Capital Securities', pays: 'CI', type: 'Banque', groupe: 'Groupe Bank of Africa', logo: '/sgi/boa-capital-securities.svg', depotMin: 'Pas de minimum', depotMinSource: 'relevé', siteWeb: 'https://www.bmcecapital.com' },
  { nom: 'Bridge Securities', pays: 'CI', type: 'Banque', groupe: 'Bridge Bank Group', logo: '/sgi/bridge-securities.svg', depotMin: '≈ 500 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'EDC Investment Corporation', pays: 'CI', type: 'Banque', groupe: 'Groupe Ecobank', logo: '/sgi/edc-investment-corporation.svg', depotMin: '1 000 000 FCFA', depotMinSource: 'relevé', siteWeb: 'https://www.ecobank.com', ficheBRVM: 'https://www.brvm.org/fr/sgi-edc-investment-corporation' },
  { nom: 'NSIA Finance', pays: 'CI', type: 'Banque', groupe: 'Groupe NSIA · devient NSIA Capital (2026)', logo: '/sgi/nsia-finance.svg', depotMin: '≈ 500 000 FCFA', depotMinSource: 'indicatif', siteWeb: 'https://nsiafinance.com', ficheBRVM: 'https://www.brvm.org/fr/sgi-nsia-finance' },
  { nom: 'SOGEBOURSE', pays: 'CI', type: 'Banque', groupe: "Société Générale Côte d'Ivoire", logo: '/sgi/sogebourse.svg', depotMin: '≈ 500 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'Hudson & Cie', pays: 'CI', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/hudson-cie.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', telephone: '+225 27 20 31 55 00', email: 'info@hudson-cie.com', siteWeb: 'https://hudson-cie.com' },
  { nom: 'Phoenix Capital Management', pays: 'CI', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/phoenix-capital-management.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', telephone: '+225 27 22 59 85 80', email: 'cms@phoenixafrica.com', siteWeb: 'https://phoenixafrica.com' },
  { nom: 'Africaine de Bourse', pays: 'CI', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/africaine-de-bourse.svg', depotMin: '1 000 000 FCFA', depotMinSource: 'relevé', siteWeb: 'https://www.sib.ci' },
  { nom: 'Sirius Capital', pays: 'CI', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/sirius-capital.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'CGF Bourse', pays: 'SN', type: 'Indépendante', groupe: 'Maison indépendante · pionnière', logo: '/sgi/cgf-bourse.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', siteWeb: 'https://www.cgfbourse.com', ficheBRVM: 'https://www.brvm.org/fr/sgi-cgf-bourse' },
  { nom: 'Impaxis Securities', pays: 'SN', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/impaxis-securities.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', siteWeb: 'https://www.impaxis-securities.com' },
  { nom: 'Everest Finance', pays: 'SN', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/everest-finance.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', siteWeb: 'https://www.everestfin.com' },
  { nom: 'Invictus Capital & Finance', pays: 'SN', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/invictus-capital-finance.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'Coris Bourse', pays: 'BF', type: 'Banque', groupe: 'Groupe Coris Bank International', logo: '/sgi/coris-bourse.svg', depotMin: '≈ 500 000 FCFA', depotMinSource: 'indicatif', siteWeb: 'https://coris-bourse.com', ficheBRVM: 'https://www.brvm.org/fr/sgi-coris-bourse-sa' },
  { nom: 'SBIF', pays: 'BF', type: 'Indépendante', groupe: "Sté Burkinabè d'Intermédiation Financière", logo: '/sgi/sbif.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'SGI Mali', pays: 'ML', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/sgi-mali.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'SGI Bénin', pays: 'BJ', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/sgi-benin.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },
  { nom: 'SGI Togo', pays: 'TG', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/sgi-togo.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif', ficheBRVM: 'https://www.brvm.org/fr/sgi-togo' },
  { nom: 'SGI Niger', pays: 'NE', type: 'Indépendante', groupe: 'Maison indépendante', logo: '/sgi/sgi-niger.svg', depotMin: '≈ 100 000 FCFA', depotMinSource: 'indicatif' },

  // Ajouts 2026-07-02 — croisés RichBourse (liste des 40 SGI) × BRVM
  // (brvm.org/fr/intervenants/sgi/tous, agrément actif confirmé page par page).
  // Type/groupe/dépôt minimum non trouvés dans ces deux sources : jamais
  // devinés à partir du nom, marqués honnêtement "Non déterminé"/"inconnu".
  { nom: 'BSIC Capital SA', pays: 'CI', type: 'Banque', groupe: 'Groupe BSIC', depotMin: '500 000 FCFA', depotMinSource: 'relevé' },
  { nom: 'Finance Gestion et Intermédiation (FGI)', pays: 'SN', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'ABCO Bourse', pays: 'SN', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'GEK Capital', pays: 'CI', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'Global Capital', pays: 'ML', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'Oragroup Securities', pays: 'CI', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu', telephone: '+225 07 88 77 15 69', email: 'contactOGS@orabank.net', siteWeb: 'https://oragroupsecurities.net' },
  { nom: 'BIIC Financial Services (BFS)', pays: 'BJ', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'MAC African SGI', pays: 'CI', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'AfricaBourse', pays: 'BJ', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'Attijari Securities West Africa', pays: 'CI', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  { nom: 'Images Finances Internationales', pays: 'BF', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  // RichBourse nomme cette SGI "Matha Capital" ; nom officiel BRVM retenu.
  { nom: 'Matha Securities', pays: 'CI', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
  // RichBourse nomme cette SGI "CIFA Bourse" ; nom officiel BRVM retenu.
  { nom: "Compagnie d'Ingénierie Financière et d'Assistance en Bourse", pays: 'ML', type: 'Non déterminé', groupe: 'Non renseigné', depotMin: 'Non renseigné', depotMinSource: 'inconnu' },
];
