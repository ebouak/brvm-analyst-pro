/**
 * Fenêtres de temps de l'audience — PUR. Tout est en UTC : la même fenêtre
 * donne les mêmes chiffres quel que soit le serveur ou le fuseau de l'exploitant.
 */
export type Periode = 'jour' | 'semaine' | 'mois' | '7j' | '30j' | '90j';
export const PERIODES: readonly Periode[] = ['jour', 'semaine', 'mois', '7j', '30j', '90j'];
export const PERIODES_PAGE = ['7j', '30j', '90j'] as const;
export const PERIODES_RAPPORT = ['jour', 'semaine', 'mois'] as const;

export interface Fenetre { debut: Date; fin: Date }
export interface Bornes extends Fenetre { precedent: Fenetre }

export const estPeriode = (v: unknown): v is Periode => typeof v === 'string' && (PERIODES as readonly string[]).includes(v);

export const LIB_PERIODE: Record<Periode, string> = {
  jour: 'la veille', semaine: 'la semaine écoulée', mois: 'le mois écoulé',
  '7j': '7 derniers jours', '30j': '30 derniers jours', '90j': '90 derniers jours',
};

const JOUR = 86_400_000;
const utc = (a: number, m: number, j: number) => new Date(Date.UTC(a, m, j));
const debutJour = (d: Date) => utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function bornesPeriode(periode: Periode, maintenant: Date): Bornes {
  if (periode === 'jour') {
    const fin = debutJour(maintenant);
    const debut = new Date(fin.getTime() - JOUR);
    return { debut, fin, precedent: { debut: new Date(debut.getTime() - JOUR), fin: debut } };
  }
  if (periode === 'semaine') {
    const j = debutJour(maintenant);
    const depuisLundi = (j.getUTCDay() + 6) % 7; // lundi = 0
    const fin = new Date(j.getTime() - depuisLundi * JOUR);
    const debut = new Date(fin.getTime() - 7 * JOUR);
    return { debut, fin, precedent: { debut: new Date(debut.getTime() - 7 * JOUR), fin: debut } };
  }
  if (periode === 'mois') {
    const a = maintenant.getUTCFullYear();
    const m = maintenant.getUTCMonth();
    const fin = utc(a, m, 1);
    const debut = utc(a, m - 1, 1);
    return { debut, fin, precedent: { debut: utc(a, m - 2, 1), fin: debut } };
  }
  // Glissant : fin arrondie à l'heure, pour que deux chargements proches partagent la même fenêtre (cache).
  const n = Number.parseInt(periode, 10);
  const fin = new Date(Math.floor(maintenant.getTime() / 3_600_000) * 3_600_000);
  const debut = new Date(fin.getTime() - n * JOUR);
  return { debut, fin, precedent: { debut: new Date(debut.getTime() - n * JOUR), fin: debut } };
}

/** « 2026-10-01 00:00:00 » — littéral HogQL (fuseau UTC posé par l'appelant). */
export const horodatageHogql = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ');

/** « 1 oct. 2026 » */
export const fmtJourFr = (d: Date): string => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Fenêtre affichée : la borne de fin est exclusive, on montre le dernier jour inclus. */
export function libelleFenetre(f: Fenetre): string {
  const dernier = new Date(f.fin.getTime() - 1);
  const a = fmtJourFr(f.debut);
  const b = fmtJourFr(dernier);
  return a === b ? a : `${a} → ${b}`;
}
