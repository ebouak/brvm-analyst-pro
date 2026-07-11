/**
 * Barème fiscal UEMOA — IRVM (dividendes) et IRC (intérêts obligataires) par
 * pays de l'émetteur. RÈGLE D'HONNÊTETÉ : chaque taux doit être adossé à une
 * source officielle (CGI national, loi de finances, note BRVM/SGI/AMF-UMOA).
 * Un taux non vérifié reste `null` → l'UI affiche « non confirmé », jamais un
 * chiffre douteux. Mise à jour = commit (historique git = audit trail).
 */

export type PaysUemoa = 'BJ' | 'BF' | 'CI' | 'GW' | 'ML' | 'NE' | 'SN' | 'TG';
export type TypeRevenu = 'dividende_cote' | 'obligation_etat' | 'obligation_privee';

export interface TauxFiscal {
  /** Taux de retenue à la source, ex. 0.10. `null` = non confirmé. */
  taux: number | null;
  /** Référence du texte officiel, ex. "CGI CI, art. 180 (LF 2025)". */
  source: string;
  sourceUrl: string | null;
  /** Date de vérification YYYY-MM-DD. */
  verifieLe: string;
  /** Particularités (exonération selon maturité, etc.). */
  note?: string;
}

export const PAYS_LABELS: Record<PaysUemoa, string> = {
  BJ: 'Bénin', BF: 'Burkina Faso', CI: "Côte d'Ivoire", GW: 'Guinée-Bissau',
  ML: 'Mali', NE: 'Niger', SN: 'Sénégal', TG: 'Togo',
};

const NON_VERIFIE: TauxFiscal = {
  taux: null, source: 'Non vérifié', sourceUrl: null, verifieLe: '2026-07-10',
};

/** Barème complet. Les entrées `NON_VERIFIE` sont remplies au fil des vérifications sourcées. */
export const BAREME: Record<PaysUemoa, Record<TypeRevenu, TauxFiscal>> = {
  BJ: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  BF: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  CI: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  GW: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  ML: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  NE: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  SN: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  TG: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
};

/** Normalise un code pays du référentiel (ex. "CI", "ci", "Côte d'Ivoire") → PaysUemoa | null. */
export function toPaysUemoa(raw: string | null | undefined): PaysUemoa | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (up in PAYS_LABELS) return up as PaysUemoa;
  const byLabel = (Object.entries(PAYS_LABELS) as [PaysUemoa, string][])
    .find(([, label]) => label.toUpperCase() === up);
  return byLabel ? byLabel[0] : null;
}
