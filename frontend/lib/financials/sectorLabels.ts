import type { Famille } from './sectors';

export const SECTOR_LABELS: Record<Famille, Record<string, string>> = {
  banque: {
    pnb: 'Produit Net Bancaire',
    produit_interets: 'Produits d’intérêts',
    marge_interets: 'Marge d’intérêts',
    depots_clientele: 'Dépôts clientèle',
    credits_clientele: 'Crédits clientèle',
    creances_douteuses: 'Créances douteuses',
    coefficient_exploitation: 'Coefficient d’exploitation (%)',
    ratio_solvabilite: 'Ratio de solvabilité (%)',
  },
  assurance: {
    primes_emises: 'Primes émises',
    primes_acquises: 'Primes acquises',
    charges_sinistres: 'Charges de sinistres',
    provisions_techniques: 'Provisions techniques',
    placements: 'Placements',
    ratio_combine: 'Ratio combiné (%)',
  },
  general: {},
};
