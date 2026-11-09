/**
 * Points clés du profil, CALCULÉS depuis nos propres comptes et dividendes
 * (jamais repris d'un tiers) : ils restent donc d'accord avec le reste de la
 * fiche. Une donnée absente fait disparaître la phrase, rien n'est deviné.
 * Deux exercices ne sont comparés que s'ils se suivent.
 */
import { fmtFcfa, fmtNumber } from '@/lib/format';

interface Exercice { year: number | null; revenue: number | null; net_income: number | null }
export interface EntreePointsCles {
  famille: 'banque' | 'assurance' | 'general' | null;
  courant: Exercice | null;
  precedent: Exercice | null;
  dividendes: { exercice: number | null; montant: number }[];
}

const pct = (v: number) => `${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v) * 100, 1)} %`;
const pctAbs = (v: number) => `${fmtNumber(Math.abs(v) * 100, 1)} %`;
const montantAction = (v: number) => fmtNumber(v, Number.isInteger(v) ? 0 : 2);

export function pointsCles({ famille, courant, precedent, dividendes }: EntreePointsCles): string[] {
  const out: string[] = [];
  const consecutifs = !!(courant?.year && precedent?.year && precedent.year === courant.year - 1);
  const libCA = famille === 'banque' ? 'produit net bancaire' : 'chiffre d’affaires';
  const LibCA = famille === 'banque' ? 'Produit net bancaire' : 'Chiffre d’affaires';

  if (courant?.year && courant.revenue != null && courant.revenue > 0) {
    const p = precedent?.revenue;
    if (consecutifs && p != null && p > 0) {
      const v = courant.revenue / p - 1;
      out.push(Math.abs(v) < 0.005
        ? `En ${courant.year}, le ${libCA} est resté stable, à ${fmtFcfa(courant.revenue)} FCFA.`
        : `En ${courant.year}, le ${libCA} a ${v > 0 ? 'progressé' : 'reculé'} de ${pctAbs(v)}, à ${fmtFcfa(courant.revenue)} FCFA.`);
    } else {
      out.push(`${LibCA} ${courant.year} : ${fmtFcfa(courant.revenue)} FCFA.`);
    }
  }

  if (courant?.year && courant.net_income != null) {
    const n = courant.net_income, p = precedent?.net_income;
    if (consecutifs && p != null) {
      if (n >= 0 && p < 0) out.push(`Le résultat net est redevenu positif, à ${fmtFcfa(n)} FCFA, après une perte en ${precedent!.year}.`);
      else if (n < 0 && p >= 0) out.push(`L’exercice ${courant.year} se solde par une perte de ${fmtFcfa(-n)} FCFA, après un bénéfice en ${precedent!.year}.`);
      else if (n < 0) out.push(`L’exercice ${courant.year} se solde par une perte de ${fmtFcfa(-n)} FCFA.`);
      else if (p > 0) {
        const v = n / p - 1;
        out.push(Math.abs(v) < 0.01
          ? `Le résultat net est resté stable (${pct(v)}), à ${fmtFcfa(n)} FCFA.`
          : `Le résultat net a ${v > 0 ? 'progressé' : 'reculé'} de ${pctAbs(v)}, à ${fmtFcfa(n)} FCFA.`);
      }
    } else if (n < 0) out.push(`L’exercice ${courant.year} se solde par une perte de ${fmtFcfa(-n)} FCFA.`);
  }

  const divs = dividendes.filter((d) => d.exercice != null && d.montant > 0).sort((a, b) => b.exercice! - a.exercice!);
  if (divs[0]) {
    const [d, prev] = divs;
    const base = `Dividende net de ${montantAction(d.montant)} FCFA par action au titre de ${d.exercice}`;
    if (prev && prev.exercice === d.exercice! - 1) {
      out.push(`${base}, contre ${montantAction(prev.montant)} FCFA pour ${prev.exercice} (${pct(d.montant / prev.montant - 1)}).`);
    } else out.push(`${base}.`);
  }
  return out;
}
