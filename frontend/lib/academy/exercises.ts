/**
 * Exercices Academy sur données LIVE — partie PURE (builders + tolérance).
 * Les loaders (I/O Supabase) vivent dans exercisesServer.ts ; ici tout est
 * testable sans réseau (exercises.test.mjs).
 *
 * Honnêteté : chaque énoncé porte la DATE des données (asOf) ; la correction
 * recalcule côté serveur avec les mêmes données.
 */

import { assessValueTrap } from '@/lib/fundamentals/valueTrap';

export type ExerciseId =
  | 'per-du-jour'
  | 'rendement-net'
  | 'value-trap-pick'
  | 'capitalisation-du-jour'
  | 'cout-ordre-du-jour'
  | 'variation-20-seances'
  | 'position-moyenne-20'
  | 'rsi-zone-du-jour'
  | 'ecart-ipo-bbgc';

export interface PublicExercise {
  id: ExerciseId;
  type: 'numeric' | 'choice';
  titre: string;
  enonce: string;
  /** Unité attendue pour la saisie numérique (ex. '×', '%'). */
  unite?: string;
  /** Options pour le type 'choice'. */
  options?: string[];
  /** Date des données utilisées (séance). */
  asOf: string;
}

export interface BuiltExercise {
  pub: PublicExercise;
  /** Valeur attendue (numeric) ou index correct (choice). */
  expected: number;
  /** Tolérance relative en % (0 pour choice). */
  tolerancePct: number;
  /** Explication renvoyée après correction. */
  explication: string;
}

const nf = new Intl.NumberFormat('fr-FR');

/** |answer − expected| ≤ tolérance relative (référence : expected). */
export function withinTolerance(answer: number, expected: number, relPct: number): boolean {
  if (!Number.isFinite(answer)) return false;
  if (expected === 0) return answer === 0;
  return Math.abs(answer - expected) / Math.abs(expected) <= relPct / 100 + 1e-9;
}

export function buildPerExercise(d: {
  code: string; cours: number; bpa: number; date: string;
}): BuiltExercise {
  const expected = d.cours / d.bpa;
  return {
    pub: {
      id: 'per-du-jour',
      type: 'numeric',
      titre: 'Calcule le PER du jour',
      enonce:
        `Au ${d.date}, ${d.code} cote ${nf.format(d.cours)} FCFA et son bénéfice par action ` +
        `(dernier exercice publié) est de ${nf.format(d.bpa)} FCFA. Quel est son PER ?`,
      unite: '×',
      asOf: d.date,
    },
    expected,
    tolerancePct: 2,
    explication:
      `PER = cours ÷ BPA = ${nf.format(d.cours)} ÷ ${nf.format(d.bpa)} ≈ ${expected.toFixed(1)}. ` +
      `Le marché paie ${expected.toFixed(1)} fois les bénéfices annuels de ${d.code}.`,
  };
}

export function buildRendementExercise(d: {
  code: string; cours: number; dividende: number; exercice: number; date: string;
}): BuiltExercise {
  const expected = (d.dividende / d.cours) * 100;
  return {
    pub: {
      id: 'rendement-net',
      type: 'numeric',
      titre: 'Calcule le rendement net du dividende',
      enonce:
        `${d.code} a versé un dividende net de ${nf.format(d.dividende)} FCFA par action au titre de ` +
        `l'exercice ${d.exercice}. Au ${d.date}, l'action cote ${nf.format(d.cours)} FCFA. ` +
        `Quel est le rendement net du dividende, en % ?`,
      unite: '%',
      asOf: d.date,
    },
    expected,
    tolerancePct: 2,
    explication:
      `Rendement = dividende ÷ cours = ${nf.format(d.dividende)} ÷ ${nf.format(d.cours)} ` +
      `≈ ${expected.toFixed(2)} %. Les dividendes BRVM sont publiés NETS (IRVM prélevé à la source).`,
  };
}

export interface TrapCandidate {
  code: string;
  nom: string;
  per: number | null;
  /** Résultats nets, ordre chronologique. */
  nets: (number | null)[];
}

/**
 * QCM « lequel est un value trap ? ». Null si aucun candidat n'est réellement
 * en piège (on ne fabrique JAMAIS un corrigé faux).
 */
export function buildTrapChoice(candidates: TrapCandidate[]): BuiltExercise | null {
  const verdicts = candidates.map((c) =>
    assessValueTrap({ per: c.per, netIncomeSeries: c.nets }),
  );
  const trapIdx = verdicts.findIndex((v) => v.isTrap);
  if (trapIdx < 0) return null;

  const t = candidates[trapIdx]!;
  return {
    pub: {
      id: 'value-trap-pick',
      type: 'choice',
      titre: 'Repère le value trap',
      enonce:
        'Parmi ces trois actions (PER et trajectoire du résultat net à la date indiquée), ' +
        'laquelle présente les signes d’un value trap ?',
      options: candidates.map(
        (c) => `${c.nom} (${c.code}) — PER ${c.per == null ? 'n/a' : c.per.toFixed(1)}`,
      ),
      asOf: new Date().toISOString().slice(0, 10),
    },
    expected: trapIdx,
    tolerancePct: 0,
    explication: `${t.nom} : ${verdicts[trapIdx]!.raison}`,
  };
}

export function buildCapitalisationExercise(d: {
  code: string; nom: string; cours: number; shares: number; date: string;
}): BuiltExercise {
  const expected = (d.cours * d.shares) / 1e9;
  return {
    pub: {
      id: 'capitalisation-du-jour',
      type: 'numeric',
      titre: 'Calcule la capitalisation boursière du jour',
      enonce:
        `Au ${d.date}, ${d.nom} (${d.code}) cote ${nf.format(d.cours)} FCFA pour ` +
        `${nf.format(d.shares)} actions admises à la cote. Quelle est sa capitalisation ` +
        `boursière totale, en milliards de FCFA (Md FCFA) ?`,
      unite: 'Md FCFA',
      asOf: d.date,
    },
    expected,
    tolerancePct: 2,
    explication:
      `Capitalisation = cours × nombre d'actions = ${nf.format(d.cours)} × ` +
      `${nf.format(d.shares)} ≈ ${expected.toFixed(1)} Md FCFA.`,
  };
}

export function buildCoutOrdreExercise(d: {
  code: string; cours: number; quantite: number; tauxPct: number; minimumFcfa: number; date: string;
}): BuiltExercise {
  const montant = d.cours * d.quantite;
  const fraisProp = montant * (d.tauxPct / 100);
  const frais = Math.max(fraisProp, d.minimumFcfa);
  const expected = montant + frais;
  return {
    pub: {
      id: 'cout-ordre-du-jour',
      type: 'numeric',
      titre: 'Calcule le coût total d’un ordre au cours du jour',
      enonce:
        `Au ${d.date}, l’action ${d.code} cote ${nf.format(d.cours)} FCFA. ` +
        `Vous passez un ordre d’achat pour ${nf.format(d.quantite)} titres avec un taux global de frais ` +
        `de ${d.tauxPct.toString().replace('.', ',')} % (et un minimum de ${nf.format(d.minimumFcfa)} FCFA par ordre). ` +
        `Quel est le montant total débité (titres + frais), en FCFA ?`,
      unite: 'FCFA',
      asOf: d.date,
    },
    expected,
    tolerancePct: 1,
    explication:
      `Montant des titres = ${nf.format(d.cours)} × ${nf.format(d.quantite)} = ${nf.format(montant)} FCFA. ` +
      `Frais = max(${nf.format(Math.round(fraisProp))}, ${nf.format(d.minimumFcfa)}) = ${nf.format(Math.round(frais))} FCFA. ` +
      `Total = ${nf.format(Math.round(expected))} FCFA.`,
  };
}

export function buildVariationExercise(d: {
  code: string;
  nom: string;
  coursInitial: number;
  dateInitiale: string;
  coursFinal: number;
  dateFinale: string;
  nbSeances?: number;
}): BuiltExercise {
  const nb = d.nbSeances ?? 20;
  const expected = ((d.coursFinal - d.coursInitial) / d.coursInitial) * 100;
  return {
    pub: {
      id: 'variation-20-seances',
      type: 'numeric',
      titre: `Mesure la variation sur ${nb} séances`,
      enonce:
        `Entre la clôture du ${d.dateInitiale} (${nf.format(d.coursInitial)} FCFA) et celle du ${d.dateFinale} ` +
        `(${nf.format(d.coursFinal)} FCFA), soit ${nb} séances, quelle est la variation du cours ` +
        `de ${d.nom} (${d.code}), en % ? (Mets un signe − en cas de baisse.)`,
      unite: '%',
      asOf: d.dateFinale,
    },
    expected,
    tolerancePct: 5,
    explication:
      `Variation = (${nf.format(d.coursFinal)} − ${nf.format(d.coursInitial)}) ÷ ` +
      `${nf.format(d.coursInitial)} = ${expected.toFixed(2)} %.`,
  };
}

export function buildPositionMoyenneExercise(d: {
  code: string; nom: string; cours: number; mm20: number; date: string;
}): BuiltExercise {
  const expected = ((d.cours - d.mm20) / d.mm20) * 100;
  return {
    pub: {
      id: 'position-moyenne-20',
      type: 'numeric',
      titre: 'Calcule l’écart du cours à sa MM20',
      enonce:
        `Au ${d.date}, ${d.nom} (${d.code}) clôture à ${nf.format(d.cours)} FCFA, tandis que sa moyenne mobile ` +
        `à 20 séances (MM20) s’établit à ${nf.format(Math.round(d.mm20))} FCFA. ` +
        `Quel est l’écart relatif du cours par rapport à sa MM20, en % ? (Signe − si le cours est sous la MM20.)`,
      unite: '%',
      asOf: d.date,
    },
    expected,
    tolerancePct: 5,
    explication:
      `Écart à la MM20 = (${nf.format(d.cours)} − ${nf.format(Math.round(d.mm20))}) ÷ ` +
      `${nf.format(Math.round(d.mm20))} = ${expected.toFixed(2)} % ` +
      `(${expected >= 0 ? 'au-dessus' : 'en dessous'} de la moyenne à 20 séances).`,
  };
}

export function buildRsiZoneChoice(d: {
  code: string; nom: string; rsi: number; date: string;
}): BuiltExercise {
  const expected = d.rsi <= 30 ? 0 : d.rsi >= 70 ? 2 : 1;
  const labels = [
    'Zone de survente (RSI ≤ 30)',
    'Zone neutre (30 < RSI < 70)',
    'Zone de surachat (RSI ≥ 70)',
  ];
  return {
    pub: {
      id: 'rsi-zone-du-jour',
      type: 'choice',
      titre: 'Identifie la zone du RSI(14) du jour',
      enonce:
        `Au ${d.date}, le RSI à 14 séances calculé sur les clôtures réelles de ${d.nom} (${d.code}) ` +
        `ressort à ${d.rsi.toFixed(1).replace('.', ',')}. Comment se lit ce niveau selon les seuils classiques de Wilder ?`,
      options: labels,
      asOf: d.date,
    },
    expected,
    tolerancePct: 0,
    explication:
      `Avec un RSI(14) de ${d.rsi.toFixed(1).replace('.', ',')} au ${d.date}, ${d.code} se situe en « ${labels[expected]} ».`,
  };
}

export function buildEcartIpoExercise(d: {
  cours: number; date: string; prixIpo?: number; code?: string; nom?: string;
}): BuiltExercise {
  const prixIpo = d.prixIpo ?? 6750;
  const code = d.code ?? 'BBGC';
  const nom = d.nom ?? 'Bridge Bank Group CI';
  const expected = ((d.cours - prixIpo) / prixIpo) * 100;
  return {
    pub: {
      id: 'ecart-ipo-bbgc',
      type: 'numeric',
      titre: 'Mesure l’écart depuis le prix d’introduction',
      enonce:
        `${nom} (${code}) a été introduite en septembre 2026 au prix d’offre de ${nf.format(prixIpo)} FCFA. ` +
        `Au ${d.date}, le titre cote ${nf.format(d.cours)} FCFA. ` +
        `Quel est l’écart de cours par rapport au prix d’introduction, en % ? (Signe − si en dessous.)`,
      unite: '%',
      asOf: d.date,
    },
    expected,
    tolerancePct: 5,
    explication:
      `Écart IPO = (${nf.format(d.cours)} − ${nf.format(prixIpo)}) ÷ ${nf.format(prixIpo)} = ${expected.toFixed(2)} %.`,
  };
}
