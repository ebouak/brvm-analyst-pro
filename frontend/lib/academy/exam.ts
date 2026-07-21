/**
 * Assemblage et correction d'un examen — PUR, testé. Les bonnes réponses ne
 * sortent d'ici que via gradeExam (appelé serveur) : assembleExam ne les renvoie
 * jamais. La correction compare la VALEUR de l'option choisie (le client renvoie
 * l'ordre qu'il a vu), donc robuste au mélange sans rejouer le PRNG.
 * Spec : docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md
 */

export interface BankQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explication: string;
}

/** Question envoyée au client : SANS `correct`, options mélangées. */
export interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface AssembledExam {
  question_ids: string[];
  questions: ExamQuestion[];
}

export interface ExamGrade {
  score: number; // 0-100
  passed: boolean;
  corrige: { id: string; correct: number; explication: string }[];
}

export const PASS_THRESHOLD = 70;
export const EXAM_SIZE = 20;

/** PRNG déterministe (mulberry32) seedé par une chaîne (hash FNV-1a). */
function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange Fisher-Yates avec un rng fourni (ne mute pas l'entrée). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function assembleExam(bank: BankQuestion[], seed: string, taille = EXAM_SIZE): AssembledExam {
  const rng = seededRng(seed);
  const picked = shuffle(bank, rng).slice(0, Math.min(taille, bank.length));
  const questions: ExamQuestion[] = picked.map((q) => ({
    id: q.id,
    question: q.question,
    options: shuffle(q.options, rng),
  }));
  return { question_ids: picked.map((q) => q.id), questions };
}

/**
 * Corrige : pour chaque réponse, compare la VALEUR de l'option choisie
 * (`a.options[a.choix]`, dans l'ordre vu par le client) à la bonne réponse de la
 * banque. Aucun rejeu du PRNG nécessaire.
 */
export function gradeExam(
  bank: BankQuestion[],
  answers: { id: string; options: string[]; choix: number }[],
): ExamGrade {
  const byId = new Map(bank.map((q) => [q.id, q]));
  let bonnes = 0;
  const corrige: ExamGrade['corrige'] = [];
  for (const a of answers) {
    const q = byId.get(a.id);
    if (!q) continue;
    const choixValeur = a.options[a.choix];
    if (choixValeur === q.options[q.correct]) bonnes++;
    corrige.push({ id: a.id, correct: q.correct, explication: q.explication });
  }
  const score = answers.length > 0 ? Math.round((bonnes / answers.length) * 100) : 0;
  return { score, passed: score >= PASS_THRESHOLD, corrige };
}
