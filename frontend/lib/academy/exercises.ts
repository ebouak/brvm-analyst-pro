/**
 * Exercices Academy sur données LIVE — partie PURE (builders + tolérance).
 * Les loaders (I/O Supabase) vivent dans exercisesServer.ts ; ici tout est
 * testable sans réseau (exercises.test.mjs).
 *
 * Honnêteté : chaque énoncé porte la DATE des données (asOf) ; la correction
 * recalcule côté serveur avec les mêmes données.
 */

import { assessValueTrap } from '@/lib/fundamentals/valueTrap';

export type ExerciseId = 'per-du-jour' | 'rendement-net' | 'value-trap-pick';

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
