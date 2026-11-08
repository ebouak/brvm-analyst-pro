import { libelleSignal } from '@/lib/signalLabel';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site

export interface Affichable { valeur: number | null; motif: string | null }

export function perAffichable(per: number | null, bpa: number | null): Affichable {
  if (bpa != null && bpa <= 0) return { valeur: null, motif: 'non calculable, perte' };
  if (per == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: per, motif: null };
}

/** BPA, source unique : résultat net ÷ nombre de titres, arrondi à 2 décimales. */
export function bpaAffichable(resultatNet: number | null, titres: number | null): Affichable {
  if (resultatNet == null || titres == null || !(titres > 0)) return { valeur: null, motif: 'non disponible' };
  return { valeur: Math.round((resultatNet / titres) * 100) / 100, motif: null };
}

export function distributionAffichable(payout: number | null, resultatNet: number | null): Affichable {
  if (resultatNet != null && resultatNet <= 0) return { valeur: null, motif: 'sans objet, perte' };
  if (payout == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: payout, motif: null };
}

export type EvolutionType = 'perte_reduite' | 'perte_aggravee' | 'retour_benefice' | 'passage_perte' | 'hausse' | 'baisse' | 'stable';
export interface EvolutionDetail { type: EvolutionType; pct: number | null }

const arrondi1 = (x: number) => Math.round(x * 10) / 10;

export function evolutionResultatDetail(n: number | null, n1: number | null): EvolutionDetail | null {
  if (n == null || n1 == null || n1 === 0) return null;
  if (n < 0 && n1 < 0) {
    const r = (Math.abs(Math.abs(n) - Math.abs(n1)) / Math.abs(n1)) * 100;
    if (arrondi1(r) === 0) return { type: 'stable', pct: null };
    return { type: Math.abs(n) < Math.abs(n1) ? 'perte_reduite' : 'perte_aggravee', pct: r };
  }
  if (n >= 0 && n1 < 0) return { type: 'retour_benefice', pct: null };
  if (n < 0 && n1 > 0) return { type: 'passage_perte', pct: null };
  const v = ((n - n1) / n1) * 100;
  if (arrondi1(v) === 0) return { type: 'stable', pct: null };
  return { type: v > 0 ? 'hausse' : 'baisse', pct: Math.abs(v) };
}

export function evolutionResultat(n: number | null, n1: number | null): string | null {
  const d = evolutionResultatDetail(n, n1);
  if (!d) return null;
  const p = d.pct != null ? nf(d.pct, 1) : '';
  switch (d.type) {
    case 'perte_reduite': return `perte réduite de ${p} %`;
    case 'perte_aggravee': return `perte aggravée de ${p} %`;
    case 'retour_benefice': return 'retour au bénéfice';
    case 'passage_perte': return 'passage en perte';
    case 'hausse': return `+${p} %`;
    case 'baisse': return `−${p} %`;
    case 'stable': return 'stable';
  }
}

export function horsExploitation(resultatAvantImpot: number | null, resultatExploitation: number | null): number | null {
  if (resultatAvantImpot == null || resultatExploitation == null) return null;
  return resultatAvantImpot - resultatExploitation;
}

export interface DividendeLigne { montant: number; exercice: number | null; ex_date: string | null; payment_date: string | null }
export interface DividendeCourant extends DividendeLigne { ancien: boolean }

/** Dernier dividende > 0. « ancien » : son exercice précède le dernier exercice publié de plus d'un an. */
export function dividendeCourant(lignes: DividendeLigne[], dernierExercice: number | null): DividendeCourant | null {
  // Une ligne sans exercice n'est pas datable : on l'écarte plutôt que de la croire la plus récente.
  const d = lignes.find((l) => l.montant > 0 && l.exercice != null);
  if (!d) return null;
  return { ...d, ancien: dernierExercice != null && d.exercice != null && dernierExercice - d.exercice > 1 };
}

export function volumeAuDessusMoyenne(volume: number | null, moyenne: number | null): boolean {
  return volume != null && moyenne != null && moyenne > 0 && volume > moyenne;
}

export function ligneVerdict(signal: string | null, score: number | null, variationPct: number | null): string | null {
  if (!signal) return null;
  const sc = score != null ? (Math.round(score * 100) === 0 ? 0 : score) : null;
  const s = sc != null ? ` · score ${moins(nf(sc, 2))}` : '';
  const base = `Signal ${libelleSignal(signal)}${s}.`;
  if (variationPct == null) return base;
  if (Math.round(variationPct * 100) === 0) return `${base} Séance stable.`;
  return `${base} Séance en ${variationPct > 0 ? 'hausse' : 'baisse'} de ${nf(Math.abs(variationPct), 2)} %.`;
}

const PHRASE_EVOLUTION = (d: EvolutionDetail): string => {
  const p = d.pct != null ? nf(d.pct, 1) : '';
  switch (d.type) {
    case 'perte_reduite': return 'la perte se réduit';
    case 'perte_aggravee': return "la perte s'aggrave";
    case 'retour_benefice': return 'le résultat redevient positif';
    case 'passage_perte': return 'le résultat passe en perte';
    case 'hausse': return `le résultat net progresse de ${p} %`;
    case 'baisse': return `le résultat net recule de ${p} %`;
    case 'stable': return 'le résultat net est stable';
  }
};

/** Synthèse d'un exercice construite uniquement sur quatre valeurs déjà affichées. */
export function syntheseExercice(p: { croissanceCaPct: number | null; evolution: ReturnType<typeof evolutionResultatDetail>; resultatExploitation: number | null; horsExpl: number | null }): string | null {
  const morceaux: string[] = [];
  if (p.croissanceCaPct != null) {
    const c = p.croissanceCaPct;
    morceaux.push(c > 100 ? "le chiffre d'affaires a plus que doublé" : c === 100 ? "le chiffre d'affaires a doublé" : c >= 0 ? "le chiffre d'affaires progresse" : "le chiffre d'affaires recule");
  }
  if (p.evolution) morceaux.push(PHRASE_EVOLUTION(p.evolution));
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

export const PLAFOND_PENALITE_RISQUE = 25;

/** `somme` = total brut des garde-fous ; le score n'en retire qu'au plus 25 points. */
export function libellePenalite(somme: number | null): string | null {
  if (somme == null || !(somme > 0)) return null;
  const brut = Math.round(somme);
  return brut > PLAFOND_PENALITE_RISQUE
    ? `Garde-fous déclenchés : −${brut} pts (pénalité plafonnée à ${PLAFOND_PENALITE_RISQUE} pts)`
    : `Garde-fous déclenchés : −${brut} pts (pénalité de ${brut} pts)`;
}
