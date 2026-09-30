/**
 * Comptes intermédiaires (trimestre, semestre) — périodes. PUR, testé
 * (tests/interim.test.ts).
 *
 * CONVENTION : un chiffre intermédiaire est un CUMUL DEPUIS LE DÉBUT DE
 * L'EXERCICE, comme dans la quasi-totalité des rapports BRVM :
 *   T1 = 3 mois (au 31 mars), S1 = 6 mois (au 30 juin), T3 = 9 mois (au 30 septembre).
 * Un « 2e trimestre » est rangé en S1 : il n'est retenu que s'il donne le cumul
 * du semestre (le garde-fou refuse un trimestre isolé).
 *
 * Stockage : `periode` = 'AAAA-T1' | 'AAAA-S1' | 'AAAA-T3' (varchar(10)),
 * `type_periode` = 'semestriel' pour S1, 'trimestre' sinon (varchar(10) : 'trimestriel' ne tient pas). La clé unique
 * (code, periode, type_periode) sépare ces lignes des exercices annuels
 * ('AAAA', 'annuel') : un intermédiaire n'écrase JAMAIS un annuel.
 *
 * ⚠️ Dupliqué dans frontend/lib/financials/interim.ts (deux paquets TS
 * distincts, comme scraper/src/hebdo/pure/). Toute correction se reporte des
 * deux côtés.
 */

export type CodeInterim = 'T1' | 'S1' | 'T3';

export const MOIS: Record<CodeInterim, number> = { T1: 3, S1: 6, T3: 9 };

export interface PeriodeInterim {
  annee: number;
  code: CodeInterim;
}

export function codePeriode(p: PeriodeInterim): string {
  return `${p.annee}-${p.code}`;
}

export function typePeriode(code: CodeInterim): 'semestriel' | 'trimestre' {
  // 'trimestre' et non 'trimestriel' : la colonne est un varchar(10) (migration 0018).
  return code === 'S1' ? 'semestriel' : 'trimestre';
}

/** '2026-S1' → { annee: 2026, code: 'S1' } ; tout autre format → null. */
export function lireCodePeriode(periode: string): PeriodeInterim | null {
  const m = /^(20\d{2})-(T1|S1|T3)$/.exec(periode);
  return m ? { annee: Number(m[1]), code: m[2] as CodeInterim } : null;
}

/**
 * Libellés à écarter : ils mentionnent un semestre sans contenir de comptes.
 *   - « Bilan semestriel du contrat de liquidité » : titres détenus par l'animateur ;
 *   - une ATTESTATION ou un RAPPORT DES COMMISSAIRES seul, sans rapport
 *     d'activités ni états financiers : l'opinion, pas les chiffres.
 */
const ECARTES = /contrat\s+de\s+liquidit/i;
const PORTE_DES_CHIFFRES = /activit|financi|r[ée]sultat|indicateur/i;

/**
 * Période d'un libellé de publication, ou null s'il ne décrit pas des comptes
 * intermédiaires exploitables.
 *   « Rapport d'activités - 1er semestre 2026 - SOCIETE GENERALE CI » → 2026-S1
 *   « Rapport d'activités - 2eme trimestre 2026 - SAFCA CI »          → 2026-S1
 *   « Rapport d'activités - 1er trimestre 2026 - SONATEL SN »         → 2026-T1
 */
export function periodeDuLibelle(libelle: string | null | undefined): PeriodeInterim | null {
  if (!libelle || ECARTES.test(libelle) || !PORTE_DES_CHIFFRES.test(libelle)) return null;
  const t = libelle.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Un libellé couvrant deux périodes (« 4ème trimestre 2025 et du 1er trimestre 2026 »)
  // est ambigu : on n'en tire rien plutôt que de deviner laquelle retenir.
  if ((t.match(/(trimestre|semestre)/g) ?? []).length > 1) return null;
  const m = /(1er|1ere|premier|2e|2eme|deuxieme|second|3e|3eme|troisieme)\s+(trimestre|semestre)\s+(20\d{2})/.exec(t);
  if (!m) return null;
  const r = m[1] ?? '';
  const rang = r.startsWith('1') || r === 'premier' ? 1 : r.startsWith('2') || r === 'deuxieme' || r === 'second' ? 2 : 3;
  const annee = Number(m[3]);
  if (m[2] === 'semestre') return rang === 1 ? { annee, code: 'S1' } : null; // S2 = l'exercice entier : attendre l'annuel
  if (rang === 1) return { annee, code: 'T1' };
  if (rang === 2) return { annee, code: 'S1' };
  return { annee, code: 'T3' };
}
