/**
 * Période couverte par un rapport d'activité, lue dans son LIBELLÉ SOURCE. PUR, testé.
 *
 * Pourquoi : la Revue ne reconnaissait que « exercice AAAA ». Un « Rapport
 * d'activités - 1er semestre 2025 » passait donc pour récent et était présenté
 * comme « ce qui se passe dans l'entreprise » dans une revue ouverte sur le
 * 1er semestre 2026 (CIEC, constaté le 2026-11-23).
 *
 * Un libellé sans année lisible (« Rapport annuel ») donne `null` : on ne
 * devine pas la période d'un document.
 */
import { lireCodePeriode, MOIS } from '@/lib/financials/interim';

export interface PeriodeRapport {
  /** Mois de fin de la période couverte, « AAAA-MM » : comparable en chaîne. */
  fin: string;
  /** « 1er semestre 2025 », « exercice 2024 »… */
  libelle: string;
}

const MOTIFS: { re: RegExp; mois: string; libelle: (a: string) => string }[] = [
  { re: /\bexercice\s+(\d{4})\b/i, mois: '12', libelle: (a) => `exercice ${a}` },
  { re: /\b(?:1er|premier)\s+trimestre\s+(\d{4})\b/i, mois: '03', libelle: (a) => `1er trimestre ${a}` },
  { re: /\b(?:2e|2eme|2ème|deuxi[eè]me|second)\s+trimestre\s+(\d{4})\b/i, mois: '06', libelle: (a) => `2e trimestre ${a}` },
  { re: /\b(?:1er|premier)\s+semestre\s+(\d{4})\b/i, mois: '06', libelle: (a) => `1er semestre ${a}` },
  { re: /\b(?:3e|3eme|3ème|troisi[eè]me)\s+trimestre\s+(\d{4})\b/i, mois: '09', libelle: (a) => `3e trimestre ${a}` },
  { re: /\b9\s+premiers\s+mois\s+(?:de\s+)?(\d{4})\b/i, mois: '09', libelle: (a) => `9 premiers mois de ${a}` },
  { re: /\bannuel\w*\s+(\d{4})\b/i, mois: '12', libelle: (a) => `exercice ${a}` },
];

export function periodeDuRapport(source: string | null | undefined): PeriodeRapport | null {
  if (!source) return null;
  for (const m of MOTIFS) {
    const r = m.re.exec(source);
    if (r) return { fin: `${r[1]}-${m.mois}`, libelle: m.libelle(r[1]!) };
  }
  return null;
}

/** Code de période de la Revue (« 2026-S1 », « 2025 ») → mois de fin « AAAA-MM » ; illisible → null. */
export function finPeriode(periode: string): string | null {
  const i = lireCodePeriode(periode);
  if (i) return `${i.annee}-${String(MOIS[i.code]).padStart(2, '0')}`;
  return /^\d{4}$/.test(periode) ? `${periode}-12` : null;
}

/** Le rapport couvre une période qui s'achève AVANT celle que la Revue présente en premier. */
export function rapportAnterieur(rapport: PeriodeRapport | null, periodeRevue: string | null | undefined): boolean {
  if (!rapport || !periodeRevue) return false;
  const fin = finPeriode(periodeRevue);
  return fin != null && rapport.fin < fin;
}
