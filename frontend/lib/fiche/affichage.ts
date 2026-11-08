import { libelleSignal } from '@/lib/signalLabel';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site

export interface Affichable { valeur: number | null; motif: string | null }

export function perAffichable(per: number | null, bpa: number | null): Affichable {
  if (bpa != null && bpa <= 0) return { valeur: null, motif: 'non calculable, perte' };
  if (per == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: per, motif: null };
}

export function distributionAffichable(payout: number | null, resultatNet: number | null): Affichable {
  if (resultatNet != null && resultatNet <= 0) return { valeur: null, motif: 'sans objet, perte' };
  if (payout == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: payout, motif: null };
}

export function evolutionResultat(n: number | null, n1: number | null): string | null {
  if (n == null || n1 == null || n1 === 0) return null;
  if (n < 0 && n1 < 0) {
    const r = (Math.abs(Math.abs(n) - Math.abs(n1)) / Math.abs(n1)) * 100;
    return `${Math.abs(n) < Math.abs(n1) ? 'perte réduite' : 'perte aggravée'} de ${nf(r, 1)} %`;
  }
  if (n >= 0 && n1 < 0) return 'retour au bénéfice';
  if (n < 0 && n1 > 0) return 'passage en perte';
  const v = ((n - n1) / n1) * 100;
  return `${v >= 0 ? '+' : '−'}${nf(Math.abs(v), 1)} %`;
}

export function horsExploitation(resultatAvantImpot: number | null, resultatExploitation: number | null): number | null {
  if (resultatAvantImpot == null || resultatExploitation == null) return null;
  return resultatAvantImpot - resultatExploitation;
}

export interface DividendeLigne { montant: number; exercice: number | null; ex_date: string | null; payment_date: string | null }
export interface DividendeCourant extends DividendeLigne { ancien: boolean }

/** Dernier dividende > 0. « ancien » : son exercice précède le dernier exercice publié de plus d'un an. */
export function dividendeCourant(lignes: DividendeLigne[], dernierExercice: number | null): DividendeCourant | null {
  const d = lignes.find((l) => l.montant > 0);
  if (!d) return null;
  return { ...d, ancien: dernierExercice != null && d.exercice != null && dernierExercice - d.exercice > 1 };
}

export function volumeAuDessusMoyenne(volume: number | null, moyenne: number | null): boolean {
  return volume != null && moyenne != null && moyenne > 0 && volume > moyenne;
}

export function ligneVerdict(signal: string | null, score: number | null, variationPct: number | null): string | null {
  if (!signal) return null;
  const s = score != null ? ` · score ${moins(nf(score, 2))}` : '';
  const v = variationPct ?? 0;
  return `Signal ${libelleSignal(signal)}${s}. Séance en ${v >= 0 ? 'hausse' : 'baisse'} de ${nf(Math.abs(v), 2)} %.`;
}

/** Synthèse d'un exercice construite uniquement sur quatre valeurs déjà affichées. */
export function syntheseExercice(p: { croissanceCaPct: number | null; evolution: string | null; resultatExploitation: number | null; horsExpl: number | null }): string | null {
  const morceaux: string[] = [];
  if (p.croissanceCaPct != null) morceaux.push(p.croissanceCaPct >= 100 ? "le chiffre d'affaires a plus que doublé" : p.croissanceCaPct >= 0 ? "le chiffre d'affaires progresse" : "le chiffre d'affaires recule");
  if (p.evolution) morceaux.push(p.evolution.startsWith('perte réduite') ? 'la perte se réduit' : p.evolution);
  let s = morceaux.join(' et ');
  if (p.resultatExploitation != null && p.resultatExploitation < 0 && p.horsExpl != null && p.horsExpl > 0) {
    s += (s ? ', mais ' : '') + "l'exploitation reste déficitaire et le résultat dépend de produits hors exploitation";
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : null;
}

/** Harmonise à l'affichage les graphies variées de la BRVM. Le document source n'est pas touché. */
export function titrePublication(t: string): string {
  return t
    .replace(/\bEtats Financiers\b/gi, 'États financiers')
    .replace(/\bEtats\b/g, 'États')
    .replace(/\s*:\s+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}
