/**
 * Noms d'émetteurs du Bulletin Officiel de la Cote → codes BRVM. Module pur.
 *
 * Le bulletin emploie ses propres noms courts (« SONATEL », « ECOBANK TG »,
 * « TOTAL », « BANK OF AFRICA BN ») qui ne sont ni les désignations de
 * brvm_instruments, ni les libellés du calendrier des dividendes.
 *
 * TABLE CURÉE, AUCUN REPLI FLOU (leçon du 2026-09-08 : un rapprochement
 * approximatif avait attribué à TTLC les dividendes de TOTAL SENEGAL). Un nom
 * inconnu reste sans code et le collecteur le NOMME dans son rapport ; la ligne
 * est tout de même enregistrée, avec son nom tel que publié.
 *
 * Chaque entrée ci-dessous a été lue dans le bulletin du 22/09/2026 (pages
 * 17-18) et rapprochée à la main des 48 codes de `frontend/lib/brvmSectors.json`.
 * Les points qui demandent un mot :
 *   - « TOTAL » seul = TotalEnergies Marketing CÔTE D'IVOIRE (TTLC) : AG du
 *     21/05/2026 au Sofitel Abidjan Hôtel Ivoire. Le Sénégal est écrit en
 *     entier (« TOTALENERGIES MARKETING SN »).
 *   - « ECOBANK TG » = le groupe ETI (ETIT) ; « ECOBANK CI » = la filiale (ECOC).
 *   - « BOLLORE TRANSPORT & LOGISTICS » = Africa Global Logistics CI (SDSC).
 *   - « ERIUM CI » = ex-Air Liquide CI (SIVC), comme dans publications/emetteur.ts.
 *   - « TRACTAFRIC CI » = Tractafric Motors CI (PRSC).
 * Nouvelle valeur ou nouveau libellé : ajouter sa ligne ici, vérifiée sur le bulletin.
 */
import { ALIAS_EMETTEURS, normaliser } from '../publications/emetteur.js';

export const NOMS_BOC: Readonly<Record<string, string>> = {
  'BANK OF AFRICA BF': 'BOABF',
  'BANK OF AFRICA BN': 'BOAB',
  'BANK OF AFRICA CI': 'BOAC',
  'BANK OF AFRICA ML': 'BOAM',
  'BANK OF AFRICA NG': 'BOAN',
  'BANK OF AFRICA SN': 'BOAS',
  'BERNABE CI': 'BNBC',
  'BICI CI': 'BICC',
  BIIC: 'BICB',
  'BOLLORE TRANSPORT & LOGISTICS': 'SDSC',
  'BRIDGE BANK GROUP COTE D\'IVOIRE': 'BBGC',
  'BRIDGE BANK GROUP CI': 'BBGC',
  'CFAO MOTORS CI': 'CFAC',
  'CIE CI': 'CIEC',
  'CORIS BANK INTERNATIONAL': 'CBIBF',
  'ECOBANK CI': 'ECOC',
  'ECOBANK TG': 'ETIT',
  'ERIUM CI': 'SIVC',
  'FILTISAC CI': 'FTSC',
  LNB: 'LNBB',
  'NEI-CEDA CI': 'NEIC',
  'NESTLE CI': 'NTLC',
  NSBC: 'NSBC',
  'ONATEL BF': 'ONTBF',
  ORAGROUP: 'ORGT',
  'ORANGE CI': 'ORAC',
  'PALM CI': 'PALC',
  'SAFCA CI': 'SAFC',
  'SAPH CI': 'SPHC',
  'SERVAIR ABIDJAN CI': 'ABJC',
  'SETAO CI': 'STAC',
  'SGB CI': 'SGBC',
  SIB: 'SIBC',
  SICABLE: 'CABC',
  SICOR: 'SICC',
  SITAB: 'STBC',
  SMB: 'SMBC',
  SODECI: 'SDCC',
  SOGB: 'SOGC',
  SOLIBRA: 'SLBC',
  SONATEL: 'SNTS',
  SUCRIVOIRE: 'SCRC',
  TOTAL: 'TTLC',
  'TOTALENERGIES MARKETING CI': 'TTLC',
  'TOTALENERGIES MARKETING SN': 'TTLS',
  'TRACTAFRIC CI': 'PRSC',
  'UNILEVER CI': 'UNLC',
  'UNIWAX CI': 'UNXC',
  'VIVO ENERGY CI': 'SHEC',
};

const TABLE: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  // Les alias vérifiés de BDFIN d'abord, la table du bulletin ensuite (prioritaire).
  for (const [k, v] of Object.entries(ALIAS_EMETTEURS)) m.set(normaliser(k), v);
  for (const [k, v] of Object.entries(NOMS_BOC)) m.set(normaliser(k), v);
  return m;
})();

/**
 * Code BRVM d'un émetteur nommé par le bulletin, ou null.
 * `codesConnus` (facultatif) accepte aussi un code boursier écrit tel quel
 * (« NSBC ») ; il ne sert jamais à deviner.
 */
export function codeEmetteur(nom: string, codesConnus?: ReadonlySet<string>): string | null {
  const n = normaliser(nom);
  const c = TABLE.get(n);
  if (c) return c;
  if (codesConnus?.has(n)) return n;
  return null;
}

/**
 * Émetteurs qui ne sont pas des sociétés cotées en actions : leur absence de
 * code est normale et ne doit pas être signalée comme un trou.
 */
export function estEmetteurHorsActions(nom: string): boolean {
  const n = normaliser(nom);
  return n === 'BRVM' || n === 'DC/BR' || n === 'DCBR' || n.startsWith('ETAT DU ') || n.startsWith('ETAT DE ')
    || /^(TPCI|TPBF|TPBJ|TPML|TPNE|TPSN|TPTG|BOAD|BIDC|CRRH|SHELTER|FCTC)/.test(n);
}
