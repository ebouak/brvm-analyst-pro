/**
 * Constat MESURÉ du dernier détachement de dividende, pour la Revue de résultats.
 *
 * Remplace un paragraphe générique (« le détachement provoque mécaniquement une
 * baisse égale au coupon […] la trajectoire du cours suit surtout la progression
 * des résultats ») : le Dossier SNTS constatait l'inverse pour ce titre, et la
 * seconde phrase affirmait une cause. Même calcul que le Dossier
 * (`expliqueDetachement`), même lecture des deux cas.
 */
import { expliqueDetachement, type Detachement } from '@/lib/fundamentals';
import { fmtNumber, fmtDateCourte } from '@/lib/format';

/** Veille = dernière séance avant l'ex-date ; jour = première séance à partir de l'ex-date. */
export function detachementDepuisSerie(
  serie: { date: string; cours: number }[],
  exDate: string,
  dividende: number,
): Detachement | null {
  const valides = serie.filter((p) => p.cours > 0);
  const ex = valides.find((p) => p.date >= exDate);
  const veille = [...valides].reverse().find((p) => p.date < exDate);
  if (!ex || !veille) return null;
  return expliqueDetachement(ex.date, dividende, veille.cours, ex.cours);
}

const fcfa = (n: number, d = 0) => `${fmtNumber(n, d)} FCFA`;

/** Phrase de constat, sans cause affirmée. */
export function phraseDetachement(d: Detachement): string {
  const date = fmtDateCourte(d.ex_date);
  const div = fcfa(d.dividende, Number.isInteger(d.dividende) ? 0 : 2);
  if (d.baisse_fcfa < d.dividende) {
    const mouvement = d.baisse_fcfa > 0 ? `le cours n’a perdu que ${fcfa(d.baisse_fcfa)}` : 'le cours n’a pas baissé';
    return `Au détachement du ${date}, ${mouvement} pour un dividende de ${div}. Soit la date enregistrée n’est pas la bonne, soit le marché a absorbé le détachement : les données disponibles ne permettent pas de trancher.`;
  }
  const part = d.part_expliquee != null ? `${fmtNumber(d.part_expliquee * 100, 0)} %` : null;
  return `Au détachement du ${date}, le cours a perdu ${fcfa(d.baisse_fcfa)} pour un dividende de ${div}`
    + (part ? ` : le montant détaché représente ${part} de la baisse du jour.` : '.');
}
