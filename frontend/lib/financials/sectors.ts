export type Famille = 'banque' | 'assurance' | 'general';

/** Clés attendues dans lignes_specifiques par famille (ordre d'affichage). */
export const SECTOR_KEYS: Record<Famille, string[]> = {
  banque: [
    'pnb', 'produit_interets', 'marge_interets', 'depots_clientele',
    'credits_clientele', 'creances_douteuses', 'coefficient_exploitation', 'ratio_solvabilite',
  ],
  assurance: [
    'primes_emises', 'primes_acquises', 'charges_sinistres',
    'provisions_techniques', 'placements', 'ratio_combine',
  ],
  general: [],
};

/** Clés stockées côté bilan (le reste va côté compte de résultat). */
export const BALANCE_KEYS = new Set<string>([
  'depots_clientele', 'credits_clientele', 'creances_douteuses',
  'ratio_solvabilite', 'provisions_techniques', 'placements',
]);

/** Mapping de référence des 48 actions BRVM -> famille comptable. */
export const FAMILLE_PAR_CODE: Record<string, Famille> = {
  BICB: 'banque', BICC: 'banque', BOAB: 'banque', BOABF: 'banque', BOAC: 'banque',
  BOAM: 'banque', BOAN: 'banque', BOAS: 'banque', CBIBF: 'banque', ECOC: 'banque',
  ETIT: 'banque', NSBC: 'banque', ORGT: 'banque', SGBC: 'banque', SIBC: 'banque',
  ABJC: 'general', BNBC: 'general', CABC: 'general', CFAC: 'general', CIEC: 'general',
  FTSC: 'general', LNBB: 'general', NEIC: 'general', NTLC: 'general', ONTBF: 'general',
  ORAC: 'general', PALC: 'general', PRSC: 'general', SAFC: 'general', SCRC: 'general',
  SDCC: 'general', SDSC: 'general', SEMC: 'general', SHEC: 'general', SICC: 'general',
  SIVC: 'general', SLBC: 'general', SMBC: 'general', SNTS: 'general', SOGC: 'general', SPHC: 'general',
  STAC: 'general', STBC: 'general', SVOC: 'general', TTLC: 'general', TTLS: 'general',
  UNLC: 'general', UNXC: 'general',
};
