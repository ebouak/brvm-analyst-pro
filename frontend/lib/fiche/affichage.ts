import { libelleSignal } from '@/lib/signalLabel';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site

export interface Affichable { valeur: number | null; motif: string | null }

/**
 * Au-delà de ce PER, le bénéfice est trop faible pour que le ratio mesure une
 * valorisation : BNBC 519×, UNLC 670×, SEMC 837× (audit du 2026-11-13). On
 * l'écrit « n.s. » plutôt que d'afficher un chiffre qui ne dit rien.
 */
export const PER_NON_SIGNIFICATIF = 100;

export function perAffichable(per: number | null, bpa: number | null): Affichable {
  if (bpa != null && bpa <= 0) return { valeur: null, motif: 'non calculable, perte' };
  if (per != null && per < 0) return { valeur: null, motif: 'non calculable, perte' };
  if (per == null) return { valeur: null, motif: 'non disponible' };
  if (per > PER_NON_SIGNIFICATIF) return { valeur: null, motif: 'n.s., bénéfice très faible' };
  return { valeur: per, motif: null };
}

/** ROE : sans objet quand les capitaux propres sont négatifs (le signe du ratio n'aurait plus de sens). */
export function roeAffichable(roe: number | null, capitauxPropres: number | null): Affichable {
  if (capitauxPropres != null && capitauxPropres <= 0) return { valeur: null, motif: 'n.s., capitaux propres négatifs' };
  if (roe == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: roe, motif: null };
}

/** Montant de dividende : décimales gardées quand le montant officiel en a (597,53 ; 0,92), entier sinon. */
export function montantDividende(montant: number): string {
  const entier = Math.abs(montant - Math.round(montant)) < 0.005;
  return `${nf(montant, entier ? 0 : 2)} FCFA`;
}

/**
 * Lignes de dividende affichables dans un historique : une ligne sans exercice
 * n'est pas datable, et un montant nul ou négatif n'est pas un versement. Ces
 * lignes restent en base (leur fausseté n'est pas prouvée, voir CLAUDE.md
 * 2026-09-08) mais ne s'affichent plus, triées par exercice décroissant.
 */
export function dividendesAffichables<T extends { exercice: number | null; montant: number }>(lignes: T[]): T[] {
  return lignes
    .filter((l) => l.exercice != null && l.montant > 0)
    .sort((a, b) => (b.exercice as number) - (a.exercice as number));
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
  // « Signal haussier », « Signal neutre » : jamais « Signal Signal baissier » (libellés du lot B).
  const lib = libelleSignal(signal);
  const base = `${lib.toLowerCase().startsWith('signal ') ? lib : `Signal ${lib.toLowerCase()}`}${s}.`;
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
  // Chaque membre porte son chiffre ; quand les deux vont dans le même sens, le
  // verbe n'est pas répété (« progresse de 8,3 % et le résultat net de 5,1 % »).
  const morceaux: string[] = [];
  let sensCa: 'hausse' | 'baisse' | null = null;
  if (p.croissanceCaPct != null) {
    const c = p.croissanceCaPct;
    const v = `${nf(Math.abs(c), 1)} %`;
    if (c > 100) morceaux.push(`le chiffre d'affaires a plus que doublé (+${v})`);
    else if (c === 100) morceaux.push("le chiffre d'affaires a doublé");
    else if (Math.abs(c) < 0.05) morceaux.push("le chiffre d'affaires est stable");
    else {
      sensCa = c > 0 ? 'hausse' : 'baisse';
      morceaux.push(`le chiffre d'affaires ${c > 0 ? 'progresse' : 'recule'} de ${v}`);
    }
  }
  if (p.evolution) {
    const e = p.evolution;
    morceaux.push(
      (e.type === 'hausse' || e.type === 'baisse') && e.type === sensCa && e.pct != null
        ? `le résultat net de ${nf(e.pct, 1)} %`
        : PHRASE_EVOLUTION(e),
    );
  }
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
export function libellePenalite(somme: number | null, appliquee?: number | null): string | null {
  if (somme == null || !(somme > 0)) return null;
  const brut = Math.round(somme);
  if (appliquee != null && appliquee > 0) {
    return `Pénalité appliquée −${nf(appliquee, 1)} pts · garde-fous déclenchés −${brut} pts, plafond ${PLAFOND_PENALITE_RISQUE}`;
  }
  return brut > PLAFOND_PENALITE_RISQUE
    ? `Garde-fous déclenchés : −${brut} pts (pénalité plafonnée à ${PLAFOND_PENALITE_RISQUE} pts)`
    : `Garde-fous déclenchés : −${brut} pts (pénalité de ${brut} pts)`;
}

/** Rendement de dividende, format unique de la fiche : « 3,39 % (ex. 2021) ». */
export function formatRendementDividende(pct: number | null, exercice: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `${nf(pct, 2)} %${exercice != null ? ` (ex. ${exercice})` : ''}`;
}

/** Même rendement, mais valeur et exercice séparés : l'exercice se pose sur sa propre ligne, sans casser « 3,39 % ». */
export function rendementDividendeParts(pct: number | null, exercice: number | null): { valeur: string; exercice: string | null } | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return { valeur: `${nf(pct, 2)} %`, exercice: exercice != null ? `ex. ${exercice}` : null };
}

/** Nombre au format français (virgule, moins typographique) ; « — » si absent. */
export function nombreFr(x: number | null | undefined, d = 2): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return moins(nf(x, d));
}

/** Pourcentage au format français, espace insécable avant « % » ; `signe` ajoute « + » aux valeurs positives. */
export function pctFr(x: number | null | undefined, d = 2, signe = false): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const r = Number(x.toFixed(d));
  return `${signe && r > 0 ? '+' : ''}${moins(nf(x, d))} %`;
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2025-05-21 » → « mai 25 » : graduation d'axe qui porte l'année. */
export function moisAnnee(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(iso);
  const mois = m ? MOIS_COURTS[Number(m[2]) - 1] : undefined;
  return m && mois ? `${mois} ${m[1]!.slice(2)}` : iso;
}

/** Lie un nombre à son unité (M, Md, FCFA, %) pour qu'une unité ne tombe jamais seule en début de ligne. */
export function insecable(texte: string): string {
  return texte.replace(/(\d) (?=(?:Md|M|k|FCFA|%))/g, '$1 ').replace(/( (?:Md|M|k)) (?=FCFA)/g, '$1 ');
}

/** Table unique des libellés d'événements : voir lib/evenements/libelles.ts. */
export { libelleEvenement } from '@/lib/evenements/libelles';
