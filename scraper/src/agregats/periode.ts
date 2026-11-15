/**
 * Période des agrégats bancaires — PUR. Les intermédiaires réutilisent la
 * règle de src/interim/periode.ts (cumul depuis le début de l'exercice, un
 * « 2e trimestre » vaut S1, un libellé à deux périodes est ambigu). Un
 * document annuel est reconnu par son libellé et une SEULE année.
 *
 * Les dates d'arrêté vivent dans dates.ts (sans dépendance, copié côté
 * frontend) ; elles sont réexportées ici.
 */
import { periodeDuLibelle } from '../interim/periode.js';
import { dateArreteDe, type CodePeriode } from './dates.js';

export { dateArreteDe, moisDe, periodeDeDate, type CodePeriode } from './dates.js';

export interface PeriodeDoc {
  annee: number;
  code: CodePeriode;
  dateArrete: string;
}

const SANS_COMPTES = /contrat\s+de\s+liquidit|convocation|assembl[ée]e|notation|dividende/i;
const ANNUEL = /(annuel|exercice|31\s*d[ée]cembre|[ée]tats\s+financiers|bilan)/i;

export function periodeDuDocument(libelle: string | null | undefined, type: string | null | undefined): PeriodeDoc | null {
  if (!libelle || SANS_COMPTES.test(libelle)) return null;
  if (type === 'ag' || type === 'notation' || type === 'avis') return null;
  const inter = periodeDuLibelle(libelle);
  if (inter) return { annee: inter.annee, code: inter.code, dateArrete: dateArreteDe(inter.annee, inter.code) };
  // Un libellé intermédiaire non retenu (S2, deux périodes) n'est pas un annuel.
  if (/trimestre|semestre/i.test(libelle)) return null;
  if (!ANNUEL.test(libelle)) return null;
  const annees = [...new Set(libelle.match(/20\d{2}/g) ?? [])];
  if (annees.length !== 1) return null;
  const annee = Number(annees[0]);
  return { annee, code: 'exercice', dateArrete: dateArreteDe(annee, 'exercice') };
}
