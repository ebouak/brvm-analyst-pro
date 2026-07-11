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

// Sources croisées le 2026-07-10 :
// [SIKA]  Sika Finance — « Dividendes/coupons à la BRVM : les différents taux
//         d'imposition pour chaque pays de l'UEMOA » (D. Gotta, 2019) — tableau
//         complet par pays.
// [RB26]  RichBourse — dossier « Dividendes BRVM » (2026) : confirme la
//         fourchette 5 %–12,5 % et la fiscalité plus favorable des obligations
//         d'État.
// [PWC]   PwC Tax Summaries Côte d'Ivoire (2026) : dividendes cotés 10 %.
const SIKA_URL =
  'https://www.sikafinance.com/analyses/chronique-dividendescoupons_a_la_brvm_les_differents_taux_dimposition_pour_chaque_pays_de_luemoa-83';
const SIKA = 'Sika Finance — fiscalité BRVM par pays (2019), fourchette confirmée RichBourse 2026';

/** Exonération régionale des titres publics (États, BOAD, BIDC) — [SIKA]. */
const ETAT_EXONERE: TauxFiscal = {
  taux: 0,
  source: `${SIKA} — coupons des titres d'État et institutions régionales (BOAD, BIDC) exonérés`,
  sourceUrl: SIKA_URL,
  verifieLe: '2026-07-10',
  note: 'Exonération des emprunts émis par les États UEMOA et institutions régionales.',
};

/** Taux usuel des obligations privées cotées (~6 %) hors Côte d'Ivoire — [SIKA]. */
const PRIVEE_USUEL: TauxFiscal = {
  taux: 0.06,
  source: `${SIKA} — taux usuel des emprunts obligataires privés cotés`,
  sourceUrl: SIKA_URL,
  verifieLe: '2026-07-10',
  note: "Taux usuel ; certaines émissions dérogent selon la maturité — vérifiez la note d'information de l'émission.",
};

const DIV = (taux: number, note?: string): TauxFiscal => ({
  taux, source: SIKA, sourceUrl: SIKA_URL, verifieLe: '2026-07-10', ...(note ? { note } : {}),
});

/** Barème complet. Les entrées `NON_VERIFIE` sont remplies au fil des vérifications sourcées. */
export const BAREME: Record<PaysUemoa, Record<TypeRevenu, TauxFiscal>> = {
  BJ: { dividende_cote: DIV(0.05, 'Taux réduit en vigueur depuis 2018.'), obligation_etat: ETAT_EXONERE, obligation_privee: PRIVEE_USUEL },
  BF: { dividende_cote: DIV(0.125), obligation_etat: ETAT_EXONERE, obligation_privee: PRIVEE_USUEL },
  CI: {
    dividende_cote: {
      taux: 0.10,
      source: `${SIKA} ; PwC Tax Summaries CI (2026) — 10 % pour les sociétés cotées (droit commun 15 %)`,
      sourceUrl: SIKA_URL,
      verifieLe: '2026-07-10',
      note: 'Quelques émetteurs (FILTISAC, SITAB…) appliquent un taux consolidé plus bas variable.',
    },
    obligation_etat: ETAT_EXONERE,
    obligation_privee: {
      taux: 0.02,
      source: `${SIKA} — Côte d'Ivoire : 2 % sur les obligations privées cotées`,
      sourceUrl: SIKA_URL,
      verifieLe: '2026-07-10',
    },
  },
  GW: { dividende_cote: NON_VERIFIE, obligation_etat: ETAT_EXONERE, obligation_privee: NON_VERIFIE },
  ML: { dividende_cote: DIV(0.07, 'Taux en vigueur depuis 2017.'), obligation_etat: ETAT_EXONERE, obligation_privee: PRIVEE_USUEL },
  NE: { dividende_cote: NON_VERIFIE, obligation_etat: ETAT_EXONERE, obligation_privee: NON_VERIFIE },
  SN: { dividende_cote: DIV(0.10), obligation_etat: ETAT_EXONERE, obligation_privee: PRIVEE_USUEL },
  TG: { dividende_cote: DIV(0.03, 'Personnes physiques (2018+) ; personnes morales : 7 %.'), obligation_etat: ETAT_EXONERE, obligation_privee: PRIVEE_USUEL },
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
